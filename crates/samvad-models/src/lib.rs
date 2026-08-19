use serde::{Deserialize, Serialize};
use ts_rs::TS;

use std::{collections::BTreeMap, str::FromStr};

// ── Models ──────────────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, Default, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct AuthTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub id_token: Option<String>,
    pub expires_in: u64,
    pub expires_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct User {
    pub sub: String,
    #[ts(optional)]
    pub name: Option<String>,
    #[ts(optional)]
    pub email: Option<String>,
    #[ts(optional)]
    pub picture: Option<String>,
    #[ts(optional)]
    pub updated_at: Option<String>,
}

/// Persistent auth state saved to `auth.yaml`.
#[derive(Debug, Clone, Serialize, Deserialize, Default, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct AuthState {
    pub user: Option<User>,
    pub tokens: Option<AuthTokens>,
}

/// In-flight PKCE session (kept in memory, not persisted).
#[derive(Debug, Clone)]
pub struct PkceSession {
    pub state: String,
    pub code_verifier: String,
    pub loopback_uri: String,
}

// ---------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "models.ts")]
pub enum HttpMethod {
    #[serde(rename = "GET")]
    Get,
    #[serde(rename = "POST")]
    Post,
    #[serde(rename = "PUT")]
    Put,
    #[serde(rename = "PATCH")]
    Patch,
    #[serde(rename = "DELETE")]
    Delete,
    #[serde(rename = "OPTIONS")]
    Options,
    #[serde(rename = "HEAD")]
    Head,
    #[serde(rename = "WS")]
    Ws,
    #[serde(rename = "QUERY")]
    Query,
}

impl HttpMethod {
    pub fn as_reqwest(&self) -> reqwest::Method {
        match self {
            HttpMethod::Get => reqwest::Method::GET,
            HttpMethod::Post => reqwest::Method::POST,
            HttpMethod::Put => reqwest::Method::PUT,
            HttpMethod::Patch => reqwest::Method::PATCH,
            HttpMethod::Delete => reqwest::Method::DELETE,
            HttpMethod::Options => reqwest::Method::OPTIONS,
            HttpMethod::Head => reqwest::Method::HEAD,
            HttpMethod::Query => reqwest::Method::QUERY,

            HttpMethod::Ws => panic!("WS requests should not go through the HTTP pipeline"),
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            HttpMethod::Get => "GET",
            HttpMethod::Post => "POST",
            HttpMethod::Put => "PUT",
            HttpMethod::Patch => "PATCH",
            HttpMethod::Delete => "DELETE",
            HttpMethod::Options => "OPTIONS",
            HttpMethod::Head => "HEAD",
            HttpMethod::Ws => "WS",
            HttpMethod::Query => "QUERY",
        }
    }
}

impl FromStr for HttpMethod {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        // Case-insensitive matching
        match s.to_uppercase().as_str() {
            "GET" => Ok(HttpMethod::Get),
            "POST" => Ok(HttpMethod::Post),
            "PUT" => Ok(HttpMethod::Put),
            "PATCH" => Ok(HttpMethod::Patch),
            "DELETE" => Ok(HttpMethod::Delete),
            "OPTIONS" => Ok(HttpMethod::Options),
            "HEAD" => Ok(HttpMethod::Head),
            "WS" => Ok(HttpMethod::Ws),
            "QUERY" => Ok(HttpMethod::Query),
            _ => Err(format!("Invalid HTTP method: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "models.ts")]
pub struct KeyValueRow {
    pub id: String,
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "models.ts")]
pub struct CookieRow {
    pub id: String,
    pub name: String,
    pub value: String,
    pub domain: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct BasicAuth {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "models.ts")]
pub struct BearerAuth {
    pub token: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub enum ApiKeyTarget {
    Header,
    Query,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct ApiKeyAuth {
    pub key: String,
    pub value: String,
    pub add_to: ApiKeyTarget,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub enum AuthType {
    #[default]
    None,
    Basic,
    Bearer,
    ApiKey,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct AuthConfig {
    #[serde(rename = "type")]
    pub auth_type: AuthType,
    pub basic: Option<BasicAuth>,
    pub bearer: Option<BearerAuth>,
    pub api_key: Option<ApiKeyAuth>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct UploadedFile {
    pub id: String,
    pub name: String,
    pub size_bytes: u64,
    /// Absolute filesystem path, populated by the `pick_files` command
    /// (native file dialog), giving the backend real disk access for
    /// multipart uploads.
    pub path: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "kebab-case")]
#[ts(export, export_to = "models.ts")]
pub enum BodyMode {
    Json,
    FormData,
    Urlencoded,
    Raw,
    Multipart,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct RequestBody {
    pub mode: Option<BodyMode>,
    #[ts(optional)]
    pub raw: Option<String>,
    #[ts(optional)]
    pub form_data: Option<Vec<KeyValueRow>>,
    #[ts(optional)]
    pub url_encoded: Option<Vec<KeyValueRow>>,
    #[ts(optional)]
    pub files: Option<Vec<UploadedFile>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct ApiRequest {
    pub id: String,
    #[serde(default)]
    pub collection_id: String,
    #[serde(default)]
    pub folder_id: Option<String>,
    pub name: String,
    pub method: HttpMethod,
    pub url: String,
    pub params: Vec<KeyValueRow>,
    pub headers: Vec<KeyValueRow>,
    pub cookies: Vec<CookieRow>,
    pub auth: AuthConfig,
    pub body: RequestBody,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct ApiResponse {
    pub status: u16,
    pub status_text: String,
    pub time_ms: u128,
    pub size_bytes: u64,
    pub headers: BTreeMap<String, String>,
    pub cookies: Vec<CookieRow>,
    pub body: String,
}

// ---------------------------------------------------------------------
// Workspaces / collections / folders
// ---------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct Collection {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct Folder {
    pub id: String,
    pub collection_id: String,
    pub parent_folder_id: Option<String>,
    pub name: String,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub enum RequestItem {
    Http(ApiRequest),
    Grpc(GrpcRequest),
}

impl RequestItem {
    pub fn id(&self) -> &str {
        match self {
            RequestItem::Http(r) => &r.id,
            RequestItem::Grpc(r) => &r.id,
        }
    }

    pub fn collection_id(&self) -> &str {
        match self {
            RequestItem::Http(r) => &r.collection_id,
            RequestItem::Grpc(r) => &r.collection_id,
        }
    }

    pub fn folder_id(&self) -> Option<&str> {
        match self {
            RequestItem::Http(r) => r.folder_id.as_deref(),
            RequestItem::Grpc(r) => r.folder_id.as_deref(),
        }
    }
}

/// Nested tree shape sent to the frontend for rendering the sidebar in
/// one shot, rather than making it re-assemble flat rows.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct CollectionTree {
    pub collection: Collection,
    pub folders: Vec<FolderNode>,
    /// Requests directly under the collection root (no folder).
    pub requests: Vec<RequestItem>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct FolderNode {
    pub folder: Folder,
    pub children: Vec<FolderNode>,
    pub requests: Vec<RequestItem>,
}

// ---------------------------------------------------------------------
// Environments
// ---------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct EnvironmentVariable {
    pub id: String,
    pub environmentid: String,
    pub key: String,
    pub value: String,
    pub enabled: bool,
    pub is_secret: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct Environment {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct EnvironmentWithVariables {
    pub environment: Environment,
    pub variables: Vec<EnvironmentVariable>,
}

// ---------------------------------------------------------------------
// History
// ---------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct HistoryEntry {
    pub id: String,
    pub request_id: Option<String>,
    pub name: Option<String>,
    pub method: HttpMethod,
    pub url: String,
    pub status: u16,
    pub duration_ms: i64,
    pub created_at: String,
}

// ---------------------------------------------------------------------
// Settings — follow-redirect / TLS / proxy behavior, all the way down
// to a single persisted JSON blob (see migrations/0001_init.sql).
// ---------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct AppSettings {
    pub follow_redirects: bool,
    pub max_redirects: u32,
    /// When `false`, the HTTP client is built with
    /// `danger_accept_invalid_certs(true)` — i.e. self-signed / invalid
    /// certs are accepted. Named for clarity in the UI ("Validate SSL
    /// certificates" toggle) rather than mirroring reqwest's "danger_*"
    /// naming directly.
    pub verify_ssl_certificates: bool,
    pub timeout_ms: u64,
    pub user_agent: String,
    pub proxy_url: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            follow_redirects: true,
            max_redirects: 10,
            verify_ssl_certificates: true,
            timeout_ms: 30_000,
            user_agent: format!("Samvad/{}", env!("CARGO_PKG_VERSION")),
            proxy_url: None,
        }
    }
}

// ---------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------

/// Mirrors the `@theme` tokens in the frontend's `src/index.css`. Custom
/// themes are just a different value set for the same keys — the
/// frontend applies a theme by writing these as CSS custom properties
/// on `:root` at runtime (see commands/themes.rs doc comment).
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct ThemeTokens {
    pub color_bg: String,
    pub color_panel: String,
    pub color_panel_raised: String,
    pub color_border: String,
    pub color_border_muted: String,
    pub color_text_primary: String,
    pub color_text_secondary: String,
    pub color_text_muted: String,
    pub color_primary: String,
    pub color_primary_hover: String,
    pub color_secondary: String,
    pub color_success: String,
    pub color_error: String,
    pub color_warning: String,
    pub radius_md: String,
    pub radius_lg: String,
    pub font_sans: String,
    pub font_mono: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct Theme {
    pub id: String,
    pub name: String,
    pub is_builtin: bool,
    pub tokens: ThemeTokens,
}

// ---------------------------------------------------------------------
// Plugins
// ---------------------------------------------------------------------

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub enum PluginHook {
    PreRequest,
    PostResponse,
}

/// `manifest.json` shape every plugin folder must provide.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub description: String,
    /// Path to the JS entry file, relative to the plugin's own folder.
    pub entry: String,
    /// Which lifecycle hooks this plugin implements. The entry script is
    /// expected to define a top-level function per hook it declares here
    /// — `preRequest(ctx)` and/or `postResponse(ctx)`.
    pub hooks: Vec<PluginHook>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct PluginRecord {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub enabled: bool,
    pub install_path: String,
    pub hooks: Vec<PluginHook>,
    pub installed_at: String,
}

// ---------------------------------------------------------------------
// Active app state (last-selected workspace / environment / theme)
// ---------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveState {
    pub active_workspace_id: Option<String>,
    pub active_environment_id: Option<String>,
    pub active_theme_id: Option<String>,
    pub active_collection_id: Option<String>,
    pub active_folder_id: Option<String>,
    pub active_item_id: Option<String>,
}

impl Default for ActiveState {
    fn default() -> Self {
        Self {
            active_workspace_id: None,
            active_environment_id: None,
            active_theme_id: None,
            active_collection_id: None,
            active_folder_id: None,
            active_item_id: None,
        }
    }
}

// --------------------------------------------------------------------
// Websocket
// --------------------------------------------------------------------

/// A saved message template the user creates for reuse — persisted to
/// YAML alongside the request that owns it.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct WsSavedMessage {
    pub id: String,
    pub name: String,
    pub data: String,
}

/// Payload emitted over the Tauri event channel for each WS frame
/// (both sent and received).
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct WsEvent {
    pub connection_id: String,
    pub direction: String,
    pub data: String,
    pub timestamp: String,
}

// -------------------------------------------------------
// gRPC
// -------------------------------------------------------

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub enum GrpcMethodType {
    #[serde(rename = "Unary")]
    Unary,
    #[serde(rename = "ClientStreaming")]
    ClientStreaming,
    #[serde(rename = "ServerStreaming")]
    ServerStreaming,
    #[serde(rename = "BidirectionalStreaming")]
    BidirectionalStreaming,
}

impl GrpcMethodType {
    pub fn as_reqwest(&self) -> reqwest::Method {
        match self {
            GrpcMethodType::Unary => reqwest::Method::GET,
            GrpcMethodType::ClientStreaming => reqwest::Method::POST,
            GrpcMethodType::ServerStreaming => reqwest::Method::PUT,
            GrpcMethodType::BidirectionalStreaming => reqwest::Method::PATCH,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            GrpcMethodType::Unary => "GET",
            GrpcMethodType::ClientStreaming => "POST",
            GrpcMethodType::ServerStreaming => "PUT",
            GrpcMethodType::BidirectionalStreaming => "PATCH",
        }
    }
}

impl FromStr for GrpcMethodType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        // Case-insensitive matching
        match s.to_uppercase().as_str() {
            "UNARY" => Ok(GrpcMethodType::Unary),
            "CLIENTSTREAMING" => Ok(GrpcMethodType::ClientStreaming),
            "SERVERSTREAMING" => Ok(GrpcMethodType::ServerStreaming),
            "BIDIRECTIONALSTREAMING" => Ok(GrpcMethodType::BidirectionalStreaming),
            _ => Err(format!("Invalid gRPC method: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub enum GrpcEventType {
    Info,
    Error,
    ClientMessage,
    ServerMessage,
    ConnectionStart,
    ConnectionEnd,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "models.ts")]
pub enum GrpcStreamType {
    Unary,
    ServerStream,
    ClientStream,
    BidiStream,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct GrpcMethod {
    pub name: String,
    pub full_name: String,
    pub request_type: String,
    pub response_type: String,
    pub stream_type: GrpcStreamType,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct GrpcService {
    pub name: String,
    pub full_name: String,
    pub methods: Vec<GrpcMethod>,
}

impl Default for GrpcEventType {
    fn default() -> Self {
        GrpcEventType::Info
    }
}

/// Represents an imported `.proto` file in the workspace
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct ProtoFile {
    pub id: String,
    pub name: String,
    /// Absolute path to the .proto file on disk
    pub path: String,
    /// Import paths needed by `protoc` (the `-I` flags)
    pub include_dirs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct GrpcRequest {
    pub id: String,
    #[serde(default)]
    pub collection_id: String,
    #[serde(default)]
    pub folder_id: Option<String>,
    pub name: String,

    /// e.g. "grpc.postman-echo.com:443"
    pub url: String,
    /// e.g. "helloworld.Greeter"
    pub service: String,
    /// e.g. "SayHello"
    pub method: String,
    pub method_type: GrpcMethodType,

    /// Equivalent to HTTP headers
    pub metadata: Vec<KeyValueRow>,
    pub auth: AuthConfig,

    /// JSON representation of the Protobuf message payload
    pub message: String,

    /// If true, use server reflection instead of local proto files
    pub use_reflection: bool,
    /// IDs of `ProtoFile` records to compile against if reflection is false
    pub proto_file_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct GrpcResponse {
    /// gRPC status code (e.g., 0 for OK, 14 for Unavailable)
    pub status: u16,
    pub status_text: String,
    pub time_ms: u128,
    pub size_bytes: u64,
    /// Response metadata (including trailing metadata)
    pub metadata: BTreeMap<String, String>,
    /// Decoded JSON representation of the returned Protobuf message
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "models.ts")]
pub struct GrpcStreamEvent {
    pub connection_id: String,
    pub direction: String, // "Sent" | "Received"
    pub message: String,
    pub timestamp: String,
}
