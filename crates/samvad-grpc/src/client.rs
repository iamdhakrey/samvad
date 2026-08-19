use std::{collections::BTreeMap, str::FromStr};

use crate::error::Error::GenericError;
use crate::error::{Error, Result};
use crate::transport::get_transport;
use async_recursion::async_recursion;
use http::Uri;
use hyper_rustls::HttpsConnector;
use hyper_util::client::legacy::Client;
use hyper_util::client::legacy::connect::HttpConnector;
use samvad_error::AppResult;
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
