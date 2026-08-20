use prost_reflect::{DynamicMessage, MessageDescriptor};
use serde::de::DeserializeSeed;
fn check(method: MessageDescriptor, payload: &str) {
    let mut deserializer = serde_json::Deserializer::from_str(payload);
    let msg: DynamicMessage = method.deserialize(&mut deserializer).unwrap();
    let _s = serde_json::to_string(&msg).unwrap();
}
fn main() {}
