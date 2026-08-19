use prost::DecodeError;
use serde::{Serialize, Serializer};
use std::io;
use thiserror::Error;
use tonic::Status;
use tonic::metadata::errors::{InvalidMetadataKey, InvalidMetadataValue};

#[derive(Error, Debug)]
pub enum Error {
    #[error("gRPC status error [{code}]: {message}", code = .0.code(), message = .0.message())]
    TonicStatus(#[from] Status),

    #[error("Protobuf descriptor error: {0}")]
    ProstReflect(#[from] prost_reflect::DescriptorError),

    #[error("JSON serialization/deserialization error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Protobuf wire decode error: {0}")]
    Decode(#[from] DecodeError),

    #[error("Invalid gRPC metadata key: {0}")]
    InvalidMetadataKey(#[from] InvalidMetadataKey),

    #[error("Invalid gRPC metadata value: {0}")]
    InvalidMetadataValue(#[from] InvalidMetadataValue),

    #[error("I/O error: {0}")]
    Io(#[from] io::Error),

    #[error(transparent)]
    App(#[from] samvad_error::AppError),

    #[error("Reflection error: {0}")]
    Reflection(String),

    #[error("{0}")]
    GenericError(String),
}

impl Error {
    pub fn reflection<T: Into<String>>(msg: T) -> Self {
        Self::Reflection(msg.into())
    }

    pub fn generic<T: Into<String>>(msg: T) -> Self {
        Self::GenericError(msg.into())
    }
}

// Allows serializing errors directly across Tauri IPC or REST boundaries
impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, Error>;
