use prost::{Message, bytes::Buf};
use prost_reflect::{DynamicMessage, MethodDescriptor};
use tonic::{
    Status,
    codec::{Codec, Decoder, Encoder},
};

#[derive(Clone)]
pub struct DynamicCodec {
    method: MethodDescriptor,
}

impl DynamicCodec {
    pub fn new(method: MethodDescriptor) -> Self {
        Self { method }
    }
}

impl Encoder for DynamicCodec {
    type Item = DynamicMessage;
    type Error = Status;

    fn encode(
        &mut self,
        item: Self::Item,
        dst: &mut tonic::codec::EncodeBuf<'_>,
    ) -> Result<(), Self::Error> {
        item.encode(dst)
            .map_err(|e| Status::internal(e.to_string()))?;
        Ok(())
    }
}

impl Decoder for DynamicCodec {
    type Item = DynamicMessage;
    type Error = Status;

    fn decode(
        &mut self,
        src: &mut tonic::codec::DecodeBuf<'_>,
    ) -> Result<Option<Self::Item>, Self::Error> {
        if !src.has_remaining() {
            return Ok(None);
        }
        let mut msg = DynamicMessage::new(self.method.output());
        msg.merge(src)
            .map_err(|e| Status::internal(e.to_string()))?;
        Ok(Some(msg))
    }
}

impl Codec for DynamicCodec {
    type Encode = DynamicMessage;
    type Decode = DynamicMessage;
    type Encoder = Self;
    type Decoder = Self;

    fn encoder(&mut self) -> Self::Encoder {
        self.clone()
    }

    fn decoder(&mut self) -> Self::Decoder {
        self.clone()
    }
}

