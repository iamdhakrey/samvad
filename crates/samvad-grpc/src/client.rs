use std::{path::Path, str::FromStr};

use http::uri::PathAndQuery;
use prost::Message;
use prost_reflect::{DescriptorPool, DynamicMessage, MethodDescriptor};
use protox::Compiler;
use serde_json::Deserializer;
use tonic::{Request, client::Grpc, transport::Endpoint};

use crate::codec::DynamicCodec;

pub fn compile_proto(
    proto_path: &str,
    service_name: &str,
    method_name: &str,
) -> Result<MethodDescriptor, String> {
    let path = Path::new(proto_path);
    let include_dir = path.parent().unwrap_or_else(|| Path::new("."));
    let file_name = path.file_name().ok_or("Invalid proto file path")?;
    let mut compiler = Compiler::new([include_dir]).map_err(|e| e.to_string())?;

    compiler.open_file(file_name).map_err(|e| e.to_string())?;
    let descriptor_set = compiler.file_descriptor_set();

    let pool = DescriptorPool::decode(descriptor_set.encode_to_vec().as_slice())
        .map_err(|e| e.to_string())?;

    let service = pool
        .get_service_by_name(service_name)
        .ok_or_else(|| format!("Service '{}' not found in descriptors", service_name))?;

    let method = service
        .methods()
        .find(|m| m.name() == method_name)
        .ok_or_else(|| {
            format!(
                "Method '{}' not found in service '{}'",
                method_name, service_name
            )
        })?;

    Ok(method)
}

pub async fn invoke_unary(
    target_url: &str,
    service_name: &str,
    method_name: &str,
    method: MethodDescriptor,
    json_payload: &str,
) -> Result<String, String> {
    let mut deserializer = Deserializer::from_str(json_payload);
    let message = DynamicMessage::deserialize(method.input(), &mut deserializer)
        .map_err(|e| format!("Failed to parse JSON into protobuf: {}", e))?;

    let endpoint = Endpoint::from_shared(target_url.to_string()).map_err(|e| e.to_string())?;
    let channel = endpoint.connect().await.map_err(|e| e.to_string())?;
    let mut client = Grpc::new(channel);

    let path = format!("/{}/{}", service_name, method_name);
    let path = PathAndQuery::from_str(&path).map_err(|e| e.to_string())?;

    let request = Request::new(message);

    client.ready().await.map_err(|e| e.to_string())?;
    let response = client
        .unary(request, path, DynamicCodec::new(method.clone()))
        .await
        .map_err(|e| e.to_string())?;

    // Convert response back to JSON
    let response_message = response.into_inner();
    serde_json::to_string_pretty(&response_message).map_err(|e| e.to_string())
}
