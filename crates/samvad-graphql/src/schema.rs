/// Re-export schema types from `samvad-models` for convenience.
/// The actual struct definitions live in `samvad-models` so they
/// can be shared with the Tauri commands layer and exported to TS via `ts-rs`.
pub use samvad_models::{
    GraphQlArg, GraphQlEnumValue, GraphQlField, GraphQlSchema, GraphQlSchemaType, GraphQlTypeRef,
};
