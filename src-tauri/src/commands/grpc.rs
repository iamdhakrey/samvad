use samvad_error::{AppError, AppResult};
use tauri::{command, State};
use samvad_models::{GrpcService, GrpcRequest, GrpcResponse};
use samvad_grpc::client::{reflect_services, get_descriptor_pool_from_reflection, invoke_unary};
use crate::state::AppState;
use std::collections::BTreeMap;
use std::time::Instant;

#[command]
pub async fn grpc_reflect(
    state: State<'_, AppState>,
    address: String,
) -> AppResult<Vec<GrpcService>> {
    let settings = crate::db::settings::get_settings(&state.data_dir)?;
    reflect_services(&address, settings.verify_ssl_certificates).await
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
    
    let pool = get_descriptor_pool_from_reflection(&request.url, validate_certificates, &request.service).await?;
    let service_desc = pool.get_service_by_name(&request.service)
        .ok_or_else(|| AppError::GrpcError(format!("Service {} not found", request.service)))?;
    
    let method_desc = service_desc.methods().find(|m| m.name() == request.method)
        .ok_or_else(|| AppError::GrpcError(format!("Method {} not found", request.method)))?;
    
    let mut metadata = BTreeMap::new();
    for row in request.metadata {
        if row.enabled {
            metadata.insert(row.key, row.value);
        }
    }
    
    let message = invoke_unary(&request.url, validate_certificates, method_desc, metadata, &request.message).await?;
    
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
pub async fn grpc_cancel(connection_id: String) -> AppResult<()> {
    Ok(())
}

#[command]
pub async fn grpc_send_message(
    connection_id: String,
    message: String,
) -> AppResult<()> {
    Ok(())
}
