use crate::client::{compile_proto_files, get_descriptor_pool_from_reflection, reflect_services};
use crate::manager::GrpcStreamManager;
use prost_reflect::DescriptorPool;
use samvad_error::AppResult;
use samvad_models::GrpcService;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Managed state for gRPC in Tauri.
/// Caches DescriptorPools to prevent re-compiling AST / re-querying reflection on every request.
#[derive(Default, Clone)]
pub struct GrpcState {
    /// Caches descriptor pools by key (e.g. endpoint URL or proto file paths)
    pub pools: Arc<RwLock<HashMap<String, DescriptorPool>>>,
    /// Manager for active bidirectional / client / server streams
    pub stream_manager: GrpcStreamManager,
}

impl GrpcState {
    pub fn new() -> Self {
        Self {
            pools: Arc::new(RwLock::new(HashMap::new())),
            stream_manager: GrpcStreamManager::new(),
        }
    }

    /// Retrieve a cached `DescriptorPool` by key
    pub async fn get_pool(&self, key: &str) -> Option<DescriptorPool> {
        self.pools.read().await.get(key).cloned()
    }

    /// Store a `DescriptorPool` in cache
    pub async fn insert_pool(&self, key: String, pool: DescriptorPool) {
        self.pools.write().await.insert(key, pool);
    }

    /// Invalidate/remove a cached pool by key
    pub async fn invalidate(&self, key: &str) -> Option<DescriptorPool> {
        self.pools.write().await.remove(key)
    }

    /// Clear all cached descriptor pools
    pub async fn clear_pools(&self) {
        self.pools.write().await.clear();
    }

    /// Retrieve or fetch a `DescriptorPool` from gRPC server reflection.
    /// Caches the resulting pool under `{endpoint}:{service}` so subsequent calls avoid network overhead.
    pub async fn get_or_reflect_pool(
        &self,
        uri_str: &str,
        validate_certificates: bool,
        service_name: &str,
    ) -> AppResult<DescriptorPool> {
        let cache_key = format!("{}:{}", uri_str.trim_end_matches('/'), service_name);

        if let Some(pool) = self.get_pool(&cache_key).await {
            return Ok(pool);
        }

        let pool =
            get_descriptor_pool_from_reflection(uri_str, validate_certificates, service_name)
                .await?;

        self.insert_pool(cache_key, pool.clone()).await;
        Ok(pool)
    }

    /// Perform full reflection discovery and cache pools for all discovered services.
    pub async fn reflect_and_cache(
        &self,
        address: &str,
        validate_certificates: bool,
    ) -> AppResult<Vec<GrpcService>> {
        let services = reflect_services(address, validate_certificates).await?;
        Ok(services)
    }

    /// Retrieve or compile `.proto` files into a `DescriptorPool`.
    /// Caches the resulting pool under the combination of file paths & include directories.
    pub async fn get_or_compile_proto(
        &self,
        files: &[String],
        include_dirs: &[String],
    ) -> AppResult<DescriptorPool> {
        let cache_key = format!("proto:{:?}:{:?}", files, include_dirs);

        if let Some(pool) = self.get_pool(&cache_key).await {
            return Ok(pool);
        }

        let pool = compile_proto_files(files, include_dirs)?;
        self.insert_pool(cache_key, pool.clone()).await;
        Ok(pool)
    }
}
