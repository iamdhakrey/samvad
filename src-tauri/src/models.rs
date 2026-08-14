use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, str::FromStr};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;

pub type WsTx = mpsc::UnboundedSender<Message>;
// ---------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyValueRow {
    pub id: String,
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CookieRow {
    pub id: String,
    pub name: String,
    pub value: String,
    pub domain: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BasicAuth {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BearerAuth {
    pub token: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ApiKeyTarget {
    Header,
    Query,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyAuth {
    pub key: String,
    pub value: String,
    pub add_to: ApiKeyTarget,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum AuthType {
    #[default]
    None,
    Basic,
    Bearer,
    ApiKey,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AuthConfig {
    #[serde(rename = "type")]
    pub auth_type: AuthType,
    pub basic: Option<BasicAuth>,
    pub bearer: Option<BearerAuth>,
    pub api_key: Option<ApiKeyAuth>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadedFile {
    pub id: String,
    pub name: String,
    pub size_bytes: u64,
    /// Absolute filesystem path, populated by the `pick_files` command
    /// (native file dialog), giving the backend real disk access for
    /// multipart uploads.
    pub path: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum BodyMode {
    Json,
    FormData,
    Urlencoded,
    Raw,
    Multipart,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RequestBody {
    pub mode: Option<BodyMode>,
    pub raw: Option<String>,
    pub form_data: Option<Vec<KeyValueRow>>,
    pub url_encoded: Option<Vec<KeyValueRow>>,
    pub files: Option<Vec<UploadedFile>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: String,
    pub collection_id: String,
    pub parent_folder_id: Option<String>,
    pub name: String,
    pub sort_order: i64,
}

/// Nested tree shape sent to the frontend for rendering the sidebar in
/// one shot, rather than making it re-assemble flat rows.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionTree {
    pub collection: Collection,
    pub folders: Vec<FolderNode>,
    /// Requests directly under the collection root (no folder).
    pub requests: Vec<ApiRequest>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderNode {
    pub folder: Folder,
    pub children: Vec<FolderNode>,
    pub requests: Vec<ApiRequest>,
}

// ---------------------------------------------------------------------
// Environments
// ---------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentVariable {
    pub id: String,
    pub environmentid: String,
    pub key: String,
    pub value: String,
    pub enabled: bool,
    pub is_secret: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Environment {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentWithVariables {
    pub environment: Environment,
    pub variables: Vec<EnvironmentVariable>,
}

// ---------------------------------------------------------------------
// History
// ---------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Theme {
    pub id: String,
    pub name: String,
    pub is_builtin: bool,
    pub tokens: ThemeTokens,
}

// ---------------------------------------------------------------------
// Plugins
// ---------------------------------------------------------------------

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PluginHook {
    PreRequest,
    PostResponse,
}

/// `manifest.json` shape every plugin folder must provide.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
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
}

// --------------------------------------------------------------------
// Websocket
// --------------------------------------------------------------------

/// A saved message template the user creates for reuse — persisted to
/// YAML alongside the request that owns it.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WsSavedMessage {
    pub id: String,
    pub name: String,
    pub data: String,
}

/// Payload emitted over the Tauri event channel for each WS frame
/// (both sent and received).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WsEvent {
    pub connection_id: String,
    pub direction: String,
    pub data: String,
    pub timestamp: String,
}
