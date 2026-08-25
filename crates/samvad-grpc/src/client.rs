use crate::codec::DynamicCodec;
use crate::error::Error::GenericError;
use crate::error::{Error, Result};
use crate::transport::get_transport;
use async_recursion::async_recursion;
use http::Uri;
use hyper_rustls::HttpsConnector;
use hyper_util::client::legacy::Client;
use hyper_util::client::legacy::connect::HttpConnector;
use prost::Message;
use prost_reflect::DescriptorPool;
use samvad_error::AppError;
use samvad_error::AppResult;
use samvad_models::{GrpcMethod, GrpcService, GrpcStreamType};
use std::{collections::BTreeMap, str::FromStr};
use tokio_stream::StreamExt as _;
use tonic::Request;
use tonic::body::Body;
use tonic::metadata::{MetadataKey, MetadataValue};
use tonic_reflection::pb::v1::server_reflection_request::MessageRequest;
use tonic_reflection::pb::v1::server_reflection_response::MessageResponse;
use tonic_reflection::pb::v1::{
    ErrorResponse, ExtensionNumberResponse, ExtensionRequest, FileDescriptorResponse,
    ListServiceResponse, ServerReflectionRequest, ServiceResponse,
};
use tonic_reflection::pb::{v1, v1alpha};
use tower::Service;

pub struct AutoReflectionClient<T = Client<HttpsConnector<HttpConnector>, Body>> {
    use_v1alpha: bool,
    client_v1: v1::server_reflection_client::ServerReflectionClient<T>,
    client_v1alpha: v1alpha::server_reflection_client::ServerReflectionClient<T>,
}

impl AutoReflectionClient {
    pub fn new(uri: &Uri, validate_certificates: bool, max_message_size: usize) -> AppResult<Self> {
        // Instantiate the transport once and clone it cheaply for both clients
        let transport = get_transport(validate_certificates)?;

        let client_v1 = v1::server_reflection_client::ServerReflectionClient::with_origin(
            transport.clone(),
            uri.clone(),
        )
        .max_decoding_message_size(max_message_size)
        .max_encoding_message_size(max_message_size);

        let client_v1alpha =
            v1alpha::server_reflection_client::ServerReflectionClient::with_origin(
                transport,
                uri.clone(),
            )
            .max_decoding_message_size(max_message_size)
            .max_encoding_message_size(max_message_size);

        Ok(Self {
            use_v1alpha: false,
            client_v1,
            client_v1alpha,
        })
    }

    #[async_recursion]
    pub async fn send_reflection_request(
        &mut self,
        message: MessageRequest,
        metadata: &BTreeMap<String, String>,
    ) -> Result<MessageResponse> {
        let v1_req = ServerReflectionRequest {
            host: String::new(),
            message_request: Some(message.clone()),
        };

        if self.use_v1alpha {
            let mut request = Request::new(tokio_stream::once(to_v1alpha_request(v1_req)));
            decorate_req(metadata, &mut request)?;

            let raw_resp = self
                .client_v1alpha
                .server_reflection_info(request)
                .await?
                .into_inner()
                .next()
                .await
                .ok_or_else(|| Error::reflection("Server closed stream without response"))??;

            let response_msg = raw_resp
                .message_response
                .ok_or_else(|| Error::reflection("Empty reflection message payload"))?;

            return Ok(to_v1_msg_response(response_msg));
        }

        // Try v1 first
        let mut request = Request::new(tokio_stream::once(v1_req));
        decorate_req(metadata, &mut request)?;

        let resp = self.client_v1.server_reflection_info(request).await;
        match resp {
            Ok(r) => Ok(r),
            Err(e) => match e.code().clone() {
                tonic::Code::Unimplemented => {
                    // If v1 fails, change to v1alpha and try again
                    self.use_v1alpha = true;
                    return self.send_reflection_request(message, metadata).await;
                }
                _ => Err(e),
            },
        }
        .map_err(|e| match e.code() {
            tonic::Code::Unavailable => GenericError("Failed to connect to endpoint".to_string()),
            tonic::Code::Unauthenticated => GenericError("Authentication failed".to_string()),
            tonic::Code::DeadlineExceeded => GenericError("Deadline exceeded".to_string()),
            _ => GenericError(e.to_string()),
        })?
        .into_inner()
        .next()
        .await
        .ok_or(GenericError("Missing reflection message".to_string()))??
        .message_response
        .ok_or(GenericError("No reflection response".to_string()))
    }
}

pub(crate) fn decorate_req<T>(
    metadata: &BTreeMap<String, String>,
    req: &mut Request<T>,
) -> Result<()> {
    let metadata_map = req.metadata_mut();
    for (k, v) in metadata {
        metadata_map.insert(
            MetadataKey::from_str(k.as_str())?,
            MetadataValue::from_str(v.as_str())?,
        );
    }
    Ok(())
}

fn to_v1alpha_request(request: ServerReflectionRequest) -> v1alpha::ServerReflectionRequest {
    v1alpha::ServerReflectionRequest {
        host: request.host,
        message_request: request.message_request.map(|m| to_v1alpha_msg_request(m)),
    }
}

fn to_v1alpha_msg_request(
    message: MessageRequest,
) -> v1alpha::server_reflection_request::MessageRequest {
    match message {
        MessageRequest::FileByFilename(v) => {
            v1alpha::server_reflection_request::MessageRequest::FileByFilename(v)
        }
        MessageRequest::FileContainingSymbol(v) => {
            v1alpha::server_reflection_request::MessageRequest::FileContainingSymbol(v)
        }
        MessageRequest::FileContainingExtension(ExtensionRequest {
            extension_number,
            containing_type,
        }) => v1alpha::server_reflection_request::MessageRequest::FileContainingExtension(
            v1alpha::ExtensionRequest {
                extension_number,
                containing_type,
            },
        ),
        MessageRequest::AllExtensionNumbersOfType(v) => {
            v1alpha::server_reflection_request::MessageRequest::AllExtensionNumbersOfType(v)
        }
        MessageRequest::ListServices(v) => {
            v1alpha::server_reflection_request::MessageRequest::ListServices(v)
        }
    }
}

fn to_v1_msg_response(
    response: v1alpha::server_reflection_response::MessageResponse,
) -> MessageResponse {
    match response {
        v1alpha::server_reflection_response::MessageResponse::FileDescriptorResponse(v) => {
            MessageResponse::FileDescriptorResponse(FileDescriptorResponse {
                file_descriptor_proto: v.file_descriptor_proto,
            })
        }
        v1alpha::server_reflection_response::MessageResponse::AllExtensionNumbersResponse(v) => {
            MessageResponse::AllExtensionNumbersResponse(ExtensionNumberResponse {
                extension_number: v.extension_number,
                base_type_name: v.base_type_name,
            })
        }
        v1alpha::server_reflection_response::MessageResponse::ListServicesResponse(v) => {
            MessageResponse::ListServicesResponse(ListServiceResponse {
                service: v
                    .service
                    .iter()
                    .map(|s| ServiceResponse {
                        name: s.name.clone(),
                    })
                    .collect(),
            })
        }
        v1alpha::server_reflection_response::MessageResponse::ErrorResponse(v) => {
            MessageResponse::ErrorResponse(ErrorResponse {
                error_code: v.error_code,
                error_message: v.error_message,
            })
        }
    }
}

pub async fn reflect_services(
    uri_str: &str,
    validate_certificates: bool,
) -> AppResult<Vec<GrpcService>> {
    let normalized_uri = if uri_str.starts_with("http://") || uri_str.starts_with("https://") {
        uri_str.to_string()
    } else {
        let scheme = if validate_certificates {
            "https"
        } else {
            "http"
        };
        format!("{}://{}", scheme, uri_str)
    };

    let uri = normalized_uri
        .parse::<http::Uri>()
        .map_err(|e| AppError::GrpcError(format!("Invalid URI: {}", e)))?;
    // let uri = uri_str
    //     .parse::<http::Uri>()
    //     .map_err(|e| AppError::GrpcError(format!("Invalid URI: {}", e)))?;
    let mut client = AutoReflectionClient::new(&uri, validate_certificates, 4 * 1024 * 1024)?;

    // 1. List services
    let list_req = MessageRequest::ListServices(String::new());
    let list_resp = client
        .send_reflection_request(list_req, &Default::default())
        .await
        .map_err(|e| AppError::GrpcError(format!("Reflection request failed: {}", e)))?;

    let services = match list_resp {
        MessageResponse::ListServicesResponse(resp) => resp.service,
        _ => {
            return Err(AppError::GrpcError(
                "Unexpected response for ListServices".to_string(),
            ));
        }
    };

    let mut pool = DescriptorPool::new();

    for service in &services {
        // Skip built-in reflection services
        if service.name == "grpc.reflection.v1alpha.ServerReflection"
            || service.name == "grpc.reflection.v1.ServerReflection"
        {
            continue;
        }

        let file_req = MessageRequest::FileContainingSymbol(service.name.clone());
        let file_resp = client
            .send_reflection_request(file_req, &Default::default())
            .await
            .map_err(|e| AppError::GrpcError(format!("Reflection request failed: {}", e)))?;

        match file_resp {
            MessageResponse::FileDescriptorResponse(resp) => {
                for fd in resp.file_descriptor_proto {
                    let fd_proto =
                        prost_reflect::prost_types::FileDescriptorProto::decode(fd.as_slice())
                            .map_err(|e| {
                                AppError::GrpcError(format!(
                                    "Failed to decode FileDescriptorProto: {}",
                                    e
                                ))
                            })?;
                    let _ = pool.add_file_descriptor_proto(fd_proto);
                }
            }
            _ => continue,
        }
    }

    let mut grpc_services = Vec::new();
    for service_desc in pool.services() {
        let mut methods = Vec::new();
        for method_desc in service_desc.methods() {
            let stream_type = match (
                method_desc.is_client_streaming(),
                method_desc.is_server_streaming(),
            ) {
                (false, false) => GrpcStreamType::Unary,
                (false, true) => GrpcStreamType::ServerStream,
                (true, false) => GrpcStreamType::ClientStream,
                (true, true) => GrpcStreamType::BidiStream,
            };
            methods.push(GrpcMethod {
                name: method_desc.name().to_string(),
                full_name: method_desc.full_name().to_string(),
                request_type: method_desc.input().full_name().to_string(),
                response_type: method_desc.output().full_name().to_string(),
                stream_type,
            });
        }
        grpc_services.push(GrpcService {
            name: service_desc.name().to_string(),
            full_name: service_desc.full_name().to_string(),
            methods,
        });
    }
    Ok(grpc_services)
}

pub async fn get_descriptor_pool_from_reflection(
    uri_str: &str,
    validate_certificates: bool,
    service_name: &str,
) -> AppResult<DescriptorPool> {
    let normalized_uri = if uri_str.starts_with("http://") || uri_str.starts_with("https://") {
        uri_str.to_string()
    } else {
        let scheme = if validate_certificates {
            "https"
        } else {
            "http"
        };
        format!("{}://{}", scheme, uri_str)
    };

    let uri = normalized_uri
        .parse::<http::Uri>()
        .map_err(|e| AppError::GrpcError(format!("Invalid URI: {}", e)))?;
    let mut client = AutoReflectionClient::new(&uri, validate_certificates, 4 * 1024 * 1024)?;
    let mut pool = DescriptorPool::new();

    let file_req = MessageRequest::FileContainingSymbol(service_name.to_string());
    let file_resp = client
        .send_reflection_request(file_req, &Default::default())
        .await
        .map_err(|e| AppError::GrpcError(format!("Reflection request failed: {}", e)))?;

    match file_resp {
        MessageResponse::FileDescriptorResponse(resp) => {
            for fd in resp.file_descriptor_proto {
                let fd_proto =
                    prost_reflect::prost_types::FileDescriptorProto::decode(fd.as_slice())
                        .map_err(|e| {
                            AppError::GrpcError(format!(
                                "Failed to decode FileDescriptorProto: {}",
                                e
                            ))
                        })?;
                let _ = pool.add_file_descriptor_proto(fd_proto);
            }
        }
        _ => {
            return Err(AppError::GrpcError(
                "Unexpected response for FileContainingSymbol".to_string(),
            ));
        }
    }

    Ok(pool)
}

pub async fn invoke_unary(
    uri_str: &str,
    validate_certificates: bool,
    method: prost_reflect::MethodDescriptor,
    _metadata: BTreeMap<String, String>,
    payload: &str,
) -> AppResult<String> {
    let normalized_uri = if uri_str.starts_with("http://") || uri_str.starts_with("https://") {
        uri_str.to_string()
    } else {
        let scheme = if validate_certificates {
            "https"
        } else {
            "http"
        };
        format!("{}://{}", scheme, uri_str)
    };

    let uri = normalized_uri
        .parse::<http::Uri>()
        .map_err(|e| AppError::GrpcError(format!("Invalid URI: {}", e)))?;
    let mut transport = get_transport(validate_certificates)?;

    let svc = tower::service_fn(move |mut req: http::Request<_>| {
        let uri = uri.clone();
        println!("uri {:?}", uri);
        let path_and_query = req
            .uri()
            .path_and_query()
            .map(|pq| pq.as_str())
            .unwrap_or("");
        let full_uri = format!(
            "{}{}",
            uri.to_string().trim_end_matches('/'),
            path_and_query
        )
        .parse::<http::Uri>()
        .unwrap();
        *req.uri_mut() = full_uri;
        transport.call(req)
    });

    let mut grpc = tonic::client::Grpc::new(svc);

    // let path = http::uri::PathAndQuery::try_from(format!("/{}", method.full_name()))
    //     .map_err(|e| AppError::GrpcError(format!("Invalid method path: {}", e)))?;

    let path_str = format!("/{}/{}", method.parent_service().full_name(), method.name());
    let path = http::uri::PathAndQuery::try_from(path_str)
        .map_err(|e| AppError::GrpcError(format!("Invalid method path: {}", e)))?;

    // Parse json payload to DynamicMessage using DeserializeSeed
    let mut deserializer = serde_json::Deserializer::from_str(payload);
    let msg: prost_reflect::DynamicMessage =
        serde::de::DeserializeSeed::deserialize(method.input(), &mut deserializer).map_err(
            |e| AppError::GrpcError(format!("Failed to parse JSON into protobuf: {}", e)),
        )?;

    let req = tonic::Request::new(msg);
    // decorate_req(&metadata, &mut req)
    //     .map_err(|e| AppError::GrpcError(format!("Failed to decorate req: {}", e)))?;

    let codec = DynamicCodec::new(method.clone());
    grpc.ready()
        .await
        .map_err(|e| AppError::GrpcError(format!("Connection not ready: {}", e)))?;

    let res = grpc
        .unary(req, path, codec)
        .await
        .map_err(|e| AppError::GrpcError(format!("Unary call failed: {}", e)))?;

    let resp_msg = res.into_inner();

    // Convert back to JSON
    let json_resp = serde_json::to_string(&resp_msg)
        .map_err(|e| AppError::GrpcError(format!("Failed to serialize response to JSON: {}", e)))?;
    // println!(" json res[p{:?}", json_resp);
    Ok(json_resp)
}
