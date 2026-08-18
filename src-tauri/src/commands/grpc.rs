use samvad_error::{AppError, AppResult};
use samvad_grpc::client::{compile_proto, invoke_unary};
use tauri::command;
#[command]
pub async fn send_grpc_unary(
    proto_path: String,
    target_url: String,
    service_name: String,
    method_name: String,
    json_payload: String,
) -> AppResult<String> {
    // In production, cache the compile_proto result to avoid rebuilding the AST every click.
    // let method = compile_proto(&proto_path, &service_name, &method_name).map_err(|e| )?;
    let method = compile_proto(&proto_path, &service_name, &method_name)
        .map_err(|e| AppError::Grpc(e.to_string()))?;
    let res = invoke_unary(
        &target_url,
        &service_name,
        &method_name,
        method,
        &json_payload,
    )
    .await
    .map_err(|e| AppError::Grpc(e.to_string()))?;

    Ok(res)
}
