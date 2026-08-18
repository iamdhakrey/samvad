use prost_reflect::DynamicMessage;
use std::collections::HashMap;
use tokio::sync::{RwLock, mpsc};

pub struct GrpcConnections {
    pub active_streams: RwLock<HashMap<String, mpsc::Sender<DynamicMessage>>>,
}

impl Default for GrpcConnections {
    fn default() -> Self {
        Self {
            active_streams: RwLock::new(HashMap::new()),
        }
    }
}
