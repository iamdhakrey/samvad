use crate::state::AppState;
use samvad_error::{AppError, AppResult};
use samvad_grpc::client::{
    compile_proto_files, descriptor_pool_to_services, find_method_descriptor,
    get_descriptor_pool_from_reflection, invoke_unary, reflect_services,
};
use samvad_models::{GrpcRequest, GrpcResponse, GrpcService};
use std::collections::BTreeMap;
use std::time::Instant;
use tauri::{command, State};

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
    _window: tauri::Window,
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

#[command]
pub async fn grpc_cancel(_connection_id: String) -> AppResult<()> {
    Ok(())
}

#[command]
pub async fn grpc_send_message(_connection_id: String, _message: String) -> AppResult<()> {
    Ok(())
}
