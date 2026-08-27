use crate::state::AppState;
use samvad_error::AppResult;
use samvad_grpc::client::{
    descriptor_pool_to_services, find_method_descriptor, invoke_unary, start_grpc_stream,
    StreamEvent,
};
use samvad_grpc::manager::GrpcActiveStream;
use samvad_models::{GrpcRequest, GrpcResponse, GrpcService, GrpcStreamEvent};
use std::collections::BTreeMap;
use std::time::Instant;
use tauri::{command, AppHandle, Emitter, Manager, State, Window};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[command]
pub async fn grpc_reflect(
    state: State<'_, AppState>,
    address: String,
) -> AppResult<Vec<GrpcService>> {
    let settings = crate::db::settings::get_settings(&state.data_dir)?;
    let services = state
        .grpc_state
        .reflect_and_cache(&address, settings.verify_ssl_certificates)
        .await?;
    Ok(services)
}

#[command]
pub async fn grpc_parse_proto(
    state: State<'_, AppState>,
    files: Vec<String>,
    include_dirs: Vec<String>,
) -> AppResult<Vec<GrpcService>> {
    let pool = state
        .grpc_state
        .get_or_compile_proto(&files, &include_dirs)
        .await?;
    Ok(descriptor_pool_to_services(&pool))
}

#[command]
pub async fn grpc_invoke(
    state: State<'_, AppState>,
    window: Window,
    request: GrpcRequest,
) -> AppResult<GrpcResponse> {
    let settings = crate::db::settings::get_settings(&state.data_dir)?;
    let validate_certificates = settings.verify_ssl_certificates;
    let start = Instant::now();

    // Use cached descriptor pool (prevents recompiling/re-reflecting on every request)
    let pool = if request.use_reflection || request.proto_file_ids.is_empty() {
        state
            .grpc_state
            .get_or_reflect_pool(&request.url, validate_certificates, &request.service)
            .await?
    } else {
        state
            .grpc_state
            .get_or_compile_proto(&request.proto_file_ids, &[])
            .await?
    };

    let method_desc = find_method_descriptor(&pool, &request.service, &request.method)?;

    let mut metadata = BTreeMap::new();
    for row in request.metadata {
        if row.enabled {
            metadata.insert(row.key, row.value);
        }
    }

    let is_streaming = method_desc.is_server_streaming() || method_desc.is_client_streaming();

    if is_streaming {
        let connection_id = Uuid::new_v4().to_string();
        let cancel_token = CancellationToken::new();

        let stream_handle = start_grpc_stream(
            cancel_token.clone(),
            &request.url,
            validate_certificates,
            method_desc.clone(),
            metadata,
            &request.message,
        )
        .await?;

        let active_stream = GrpcActiveStream {
            connection_id: connection_id.clone(),
            cancel_token,
            outbound_tx: stream_handle.outbound_tx,
            input_descriptor: method_desc.input(),
        };

        state.grpc_state.stream_manager.insert(active_stream).await;

        let app_handle = window.app_handle().clone();
        let cid = connection_id.clone();
        let stream_manager = state.grpc_state.stream_manager.clone();
        let mut rx = stream_handle.rx;

        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                let timestamp = chrono::Utc::now().to_rfc3339();
                match event {
                    StreamEvent::Message(data) => {
                        let _ = app_handle.emit(
                            "grpc://message",
                            GrpcStreamEvent {
                                connection_id: cid.clone(),
                                direction: "received".to_string(),
                                message: data,
                                timestamp,
                            },
                        );
                    }
                    StreamEvent::Metadata(meta) => {
                        let _ = app_handle.emit(
                            "grpc://metadata",
                            serde_json::json!({
                                "connectionId": cid,
                                "metadata": meta,
                            }),
                        );
                    }
                    StreamEvent::Error {
                        message,
                        code,
                        status_text,
                        metadata,
                    } => {
                        let _ = app_handle.emit(
                            "grpc://message",
                            GrpcStreamEvent {
                                connection_id: cid.clone(),
                                direction: "received".to_string(),
                                message: format!("{}: {}", status_text, message),
                                timestamp: timestamp.clone(),
                            },
                        );
                        let _ = app_handle.emit(
                            "grpc://status",
                            serde_json::json!({
                                "connectionId": cid,
                                "status": "error",
                                "error": message,
                                "statusCode": code,
                                "statusText": status_text,
                                "metadata": metadata,
                            }),
                        );
                    }
                    StreamEvent::Closed { metadata } => {
                        let _ = app_handle.emit(
                            "grpc://status",
                            serde_json::json!({
                                "connectionId": cid,
                                "status": "closed",
                                "metadata": metadata,
                            }),
                        );
                    }
                }
            }
            let _ = stream_manager.remove(&cid).await;
        });

        let duration_ms = start.elapsed().as_millis();
        let mut resp_metadata = BTreeMap::new();
        resp_metadata.insert("x-samvad-connection-id".to_string(), connection_id);

        Ok(GrpcResponse {
            status: 0,
            status_text: "Streaming".to_string(),
            time_ms: duration_ms,
            size_bytes: 0,
            metadata: resp_metadata,
            message: "Stream established".to_string(),
        })
    } else {
        let unary_res = invoke_unary(
            &request.url,
            validate_certificates,
            method_desc,
            metadata,
            &request.message,
        )
        .await?;

        let duration_ms = start.elapsed().as_millis();

        Ok(GrpcResponse {
            status: unary_res.status,
            status_text: unary_res.status_text,
            time_ms: duration_ms,
            size_bytes: unary_res.message.len() as u64,
            metadata: unary_res.metadata,
            message: unary_res.message,
        })
    }
}

#[command]
pub async fn grpc_send_message(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    connection_id: String,
    message: String,
) -> AppResult<()> {
    state
        .grpc_state
        .stream_manager
        .send_message(&connection_id, &message)
        .await
        .map_err(|e| samvad_error::AppError::GrpcError(e))?;

    let timestamp = chrono::Utc::now().to_rfc3339();
    let _ = app_handle.emit(
        "grpc://message",
        GrpcStreamEvent {
            connection_id,
            direction: "sent".to_string(),
            message,
            timestamp,
        },
    );

    Ok(())
}

#[command]
pub async fn grpc_cancel(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    connection_id: String,
) -> AppResult<()> {
    let cancelled = state.grpc_state.stream_manager.cancel(&connection_id).await;
    if cancelled {
        let _ = app_handle.emit(
            "grpc://status",
            serde_json::json!({
                "connectionId": connection_id,
                "status": "cancelled",
            }),
        );
    }
    Ok(())
}
