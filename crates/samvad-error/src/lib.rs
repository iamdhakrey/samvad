use serde::{Serialize, Serializer};

/// Single error type for every command in the backend. Tauri requires
/// command error types to implement `Serialize` (it ships them to the
/// frontend as the rejected value of the `invoke()` promise) — we just
/// serialize to the display string, which is enough for the UI to show
/// in a toast/inline error without leaking internal error shapes.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("not found: {0}")]
    NotFound(String),

    #[error("invalid input: {0}")]
    Invalid(String),

    #[error("request failed: {0}")]
    Http(String),

    #[error("plugin script error: {0}")]
    Script(String),

    #[error("websocket error: {0}")]
    WebSocket(String),

    #[error("tungstenite error: {0}")]
    Tungstenite(#[from] tokio_tungstenite::tungstenite::Error),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("serialization error (json): {0}")]
    Json(#[from] serde_json::Error),

    #[error("serialization error (yaml): {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("grpc error: {0}")]
    Tonic(#[from] tonic::ConnectError),

    #[error("gRPC engine error: {0}")]
    GrpcError(String),

    #[error("grpc error: {0}")]
    Prost(#[from] prost_reflect::DescriptorError),

    #[error("grpc connection error: {0}")]
    TonicConnect(#[from] tonic::transport::Error), // updated to generic transport error

    #[error("grpc status error [{}] {}", .0.code(), .0.message())]
    TonicStatus(#[from] tonic::Status),

    // #[error("{0}")]
    // StringError(#[from] std::string::String),
    #[error("{0}")]
    Other(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
