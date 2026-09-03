use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;

/// Handle for an active GraphQL subscription connection.
pub struct GraphQlSubscriptionHandle {
    pub connection_id: String,
    pub cancel_token: CancellationToken,
}

/// Managed in-memory state for active GraphQL subscriptions.
#[derive(Default, Clone)]
pub struct GraphQlState {
    pub subscriptions: Arc<RwLock<HashMap<String, GraphQlSubscriptionHandle>>>,
}

impl GraphQlState {
    pub fn new() -> Self {
        Self {
            subscriptions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a new active subscription handle.
    pub async fn insert(&self, handle: GraphQlSubscriptionHandle) {
        self.subscriptions
            .write()
            .await
            .insert(handle.connection_id.clone(), handle);
    }

    /// Remove and return a handle by connection ID.
    pub async fn remove(&self, connection_id: &str) -> Option<GraphQlSubscriptionHandle> {
        self.subscriptions.write().await.remove(connection_id)
    }

    /// Cancel an active subscription, returning `true` if it was found.
    pub async fn cancel(&self, connection_id: &str) -> bool {
        if let Some(handle) = self.subscriptions.write().await.remove(connection_id) {
            handle.cancel_token.cancel();
            true
        } else {
            false
        }
    }

    /// Return whether a subscription is currently active.
    pub async fn is_active(&self, connection_id: &str) -> bool {
        self.subscriptions.read().await.contains_key(connection_id)
    }
}
