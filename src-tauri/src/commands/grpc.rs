use crate::state::AppState;
use samvad_error::{AppError, AppResult};
use samvad_grpc::client::{
    compile_proto_files, descriptor_pool_to_services, find_method_descriptor,
    get_descriptor_pool_from_reflection, invoke_unary, reflect_services, start_grpc_stream,
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
    let res = reflect_services(&address, settings.verify_ssl_certificates).await;
    return res;
}

#[command]
pub async fn grpc_parse_proto(
    files: Vec<String>,
    include_dirs: Vec<String>,
) -> AppResult<Vec<GrpcService>> {
    let pool = compile_proto_files(&files, &include_dirs)?;
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

    let pool = if request.use_reflection || request.proto_file_ids.is_empty() {
        get_descriptor_pool_from_reflection(&request.url, validate_certificates, &request.service)
            .await?
    } else {
        compile_proto_files(&request.proto_file_ids, &[] as &[String])?
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

        state.grpc_streams.insert(active_stream).await;

        let app_handle = window.app_handle().clone();
        let cid = connection_id.clone();
        let grpc_streams = state.grpc_streams.clone();
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
                    StreamEvent::Error(err) => {
                        let _ = app_handle.emit(
                            "grpc://message",
                            GrpcStreamEvent {
                                connection_id: cid.clone(),
                                direction: "received".to_string(),
                                message: format!("Error: {}", err),
                                timestamp: timestamp.clone(),
                            },
                        );
                        let _ = app_handle.emit(
                            "grpc://status",
                            serde_json::json!({
                                "connectionId": cid,
                                "status": "error",
                                "error": err,
                            }),
                        );
                    }
                    StreamEvent::Closed => {
                        let _ = app_handle.emit(
                            "grpc://status",
                            serde_json::json!({
                                "connectionId": cid,
                                "status": "closed",
                            }),
                        );
                    }
                }
            }
            let _ = grpc_streams.remove(&cid).await;
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
        let message = invoke_unary(
            &request.url,
            validate_certificates,
            method_desc,
            metadata,
            &request.message,
        )
        .await?;

        let duration_ms = start.elapsed().as_millis();

        Ok(GrpcResponse {
            status: 0,
            status_text: "OK".to_string(),
            time_ms: duration_ms,
            size_bytes: message.len() as u64,
            metadata: BTreeMap::new(),
            message,
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
        .grpc_streams
        .send_message(&connection_id, &message)
        .await
        .map_err(|e| AppError::GrpcError(e))?;

    // Emit event so the message is reflected in the frontend sent message log
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
    let cancelled = state.grpc_streams.cancel(&connection_id).await;
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
