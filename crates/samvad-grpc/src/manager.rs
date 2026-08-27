use prost_reflect::{DynamicMessage, MessageDescriptor};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tokio_util::sync::CancellationToken;

pub struct GrpcActiveStream {
    pub connection_id: String,
    pub cancel_token: CancellationToken,
    pub outbound_tx: Option<mpsc::Sender<DynamicMessage>>,
    pub input_descriptor: MessageDescriptor,
}

#[derive(Default, Clone)]
pub struct GrpcStreamManager {
    pub active_streams: Arc<RwLock<HashMap<String, GrpcActiveStream>>>,
}

impl GrpcStreamManager {
    pub fn new() -> Self {
        Self {
            active_streams: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn insert(&self, stream: GrpcActiveStream) {
        self.active_streams
            .write()
            .await
            .insert(stream.connection_id.clone(), stream);
    }

    pub async fn remove(&self, connection_id: &str) -> Option<GrpcActiveStream> {
        self.active_streams.write().await.remove(connection_id)
    }

    pub async fn send_message(&self, connection_id: &str, payload: &str) -> Result<(), String> {
        let streams = self.active_streams.read().await;
        let stream = streams
            .get(connection_id)
            .ok_or_else(|| format!("Active gRPC stream '{}' not found", connection_id))?;

        let tx = stream.outbound_tx.as_ref().ok_or_else(|| {
            "Current gRPC stream does not accept outbound client messages (ServerStreaming only)"
                .to_string()
        })?;

        let mut deserializer = serde_json::Deserializer::from_str(payload);
        let msg: DynamicMessage = serde::de::DeserializeSeed::deserialize(
            stream.input_descriptor.clone(),
            &mut deserializer,
        )
        .map_err(|e| format!("Failed to parse JSON into protobuf message: {}", e))?;

        tx.send(msg)
            .await
            .map_err(|_| "Stream channel has been closed".to_string())?;

        Ok(())
    }

    pub async fn cancel(&self, connection_id: &str) -> bool {
        if let Some(stream) = self.active_streams.write().await.remove(connection_id) {
            stream.cancel_token.cancel();
            true
        } else {
            false
        }
    }
}
