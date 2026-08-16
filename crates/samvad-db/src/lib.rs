use std::path::{Path, PathBuf};

use samvad_error::AppResult;
use samvad_models::{ActiveState, AppSettings, HttpMethod, Theme, ThemeTokens, Workspace};
use serde::{Serialize, de::DeserializeOwned};

#[derive(Debug, Clone)]
pub struct DataDir {
    root: PathBuf,
}

impl DataDir {
    pub fn root(&self) -> &Path {
        &self.root
    }

    // -- Convenience path builders ------------------------------------------

    pub fn app_state_path(&self) -> PathBuf {
        self.root.join("app_state.yaml")
    }

    pub fn settings_path(&self) -> PathBuf {
        self.root.join("settings.yaml")
    }

    pub fn themes_path(&self) -> PathBuf {
        self.root.join("themes.yaml")
    }

    pub fn plugins_path(&self) -> PathBuf {
        self.root.join("plugins.yaml")
    }

    pub fn history_path(&self) -> PathBuf {
        self.root.join("history.yaml")
    }

    pub fn workspaces_dir(&self) -> PathBuf {
        self.root.join("workspaces")
    }

    pub fn workspace_dir(&self, workspace_id: &str) -> PathBuf {
        self.workspaces_dir().join(workspace_id)
    }

    pub fn workspace_meta_path(&self, workspace_id: &str) -> PathBuf {
        self.workspace_dir(workspace_id).join("workspace.yaml")
    }

    pub fn environments_path(&self, workspace_id: &str) -> PathBuf {
        self.workspace_dir(workspace_id).join("environments.yaml")
    }

    pub fn collections_dir(&self, workspace_id: &str) -> PathBuf {
        self.workspace_dir(workspace_id).join("collections")
    }

    pub fn collection_dir(&self, workspace_id: &str, collection_id: &str) -> PathBuf {
        self.collections_dir(workspace_id).join(collection_id)
    }

    pub fn collection_meta_path(&self, workspace_id: &str, collection_id: &str) -> PathBuf {
        self.collection_dir(workspace_id, collection_id)
            .join("collection.yaml")
    }

    pub fn requests_dir(&self, workspace_id: &str, collection_id: &str) -> PathBuf {
        self.collection_dir(workspace_id, collection_id)
            .join("requests")
    }

    pub fn request_path(
        &self,
        workspace_id: &str,
        collection_id: &str,
        request_id: &str,
    ) -> PathBuf {
        self.requests_dir(workspace_id, collection_id)
            .join(format!("{request_id}.yaml"))
    }

    pub fn folders_dir(&self, workspace_id: &str, collection_id: &str) -> PathBuf {
        self.collection_dir(workspace_id, collection_id)
            .join("folders")
    }

    pub fn folder_path(&self, workspace_id: &str, collection_id: &str, folder_id: &str) -> PathBuf {
        self.folders_dir(workspace_id, collection_id)
            .join(format!("{folder_id}.yaml"))
    }

    /// Per-request YAML file that stores the user's saved WS message
    /// templates.  Lives at `<data>/ws_messages/<request_id>.yaml`.
    pub fn ws_saved_messages_path(&self, request_id: &str) -> PathBuf {
        self.root
            .join("ws_messages")
            .join(format!("{request_id}.yaml"))
    }
}

// ---------------------------------------------------------------------------
// Generic YAML read/write helpers
// ---------------------------------------------------------------------------

pub fn read_yaml<T: DeserializeOwned>(path: &Path) -> AppResult<T> {
    let contents = std::fs::read_to_string(path)?;
    let value = serde_yaml::from_str(&contents)?;
    Ok(value)
}

pub fn write_yaml<T: Serialize>(path: &Path, value: &T) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let yaml = serde_yaml::to_string(value)?;
    std::fs::write(path, yaml)?;
    Ok(())
}

/// Read a YAML file or return a default value if it doesn't exist.
pub fn read_yaml_or_default<T: DeserializeOwned + Default>(path: &Path) -> AppResult<T> {
    if path.exists() {
        read_yaml(path)
    } else {
        Ok(T::default())
    }
}

/// Read a YAML file containing a `Vec<T>`, returning an empty vec if
/// the file doesn't exist.
pub fn read_yaml_vec<T: DeserializeOwned>(path: &Path) -> AppResult<Vec<T>> {
    if path.exists() {
        read_yaml(path)
    } else {
        Ok(Vec::new())
    }
}

// ---------------------------------------------------------------------------
// Initialization — seed default data when starting fresh
// ---------------------------------------------------------------------------

/// Creates the data directory hierarchy and seeds default files when
/// they don't already exist.  Called once from `lib.rs`'s setup hook.
pub fn init_data_dir(data_dir: &Path) -> AppResult<DataDir> {
    let root = data_dir.join("data");
    std::fs::create_dir_all(&root)?;

    let dd = DataDir { root };

    // -- Seed defaults only when the files are missing ---------------------

    // Default workspace
    let default_ws_id = "default-workspace";
    if !dd.workspace_meta_path(default_ws_id).exists() {
        let ws = Workspace {
            id: default_ws_id.to_string(),
            name: "My Workspace".to_string(),
            created_at: now_iso(),
            updated_at: now_iso(),
        };
        std::fs::create_dir_all(dd.workspace_dir(default_ws_id))?;
        write_yaml(&dd.workspace_meta_path(default_ws_id), &ws)?;
    }

    // Default settings
    if !dd.settings_path().exists() {
        write_yaml(&dd.settings_path(), &AppSettings::default())?;
    }

    // Built-in theme
    if !dd.themes_path().exists() {
        let varta_dark = Theme {
            id: "varta-dark".to_string(),
            name: "Samvad Dark".to_string(),
            is_builtin: true,
            tokens: ThemeTokens {
                color_bg: "#0D1117".to_string(),
                color_panel: "#161B22".to_string(),
                color_panel_raised: "#1C2129".to_string(),
                color_border: "#30363D".to_string(),
                color_border_muted: "#21262D".to_string(),
                color_text_primary: "#E6EDF3".to_string(),
                color_text_secondary: "#8B949E".to_string(),
                color_text_muted: "#6E7681".to_string(),
                color_primary: "#8B5CF6".to_string(),
                color_primary_hover: "#9D74F8".to_string(),
                color_secondary: "#3B82F6".to_string(),
                color_success: "#10B981".to_string(),
                color_error: "#EF4444".to_string(),
                color_warning: "#F59E0B".to_string(),
                radius_md: "8px".to_string(),
                radius_lg: "10px".to_string(),
                font_sans: "Inter, ui-sans-serif, system-ui".to_string(),
                font_mono: "JetBrains Mono, ui-monospace, monospace".to_string(),
            },
        };
        write_yaml(&dd.themes_path(), &vec![varta_dark])?;
    }

    // Default app state
    if !dd.app_state_path().exists() {
        let state = ActiveState {
            active_workspace_id: Some(default_ws_id.to_string()),
            active_environment_id: None,
            active_theme_id: Some("varta-dark".to_string()),
        };
        write_yaml(&dd.app_state_path(), &state)?;
    }

    // -- Migrations ----------------------------------------------------------
    migrate_ws_method(&dd);

    Ok(dd)
}

// ---------------------------------------------------------------------------
// Shared utilities (unchanged from the SQLite version)
// ---------------------------------------------------------------------------

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

// ---------------------------------------------------------------------------
// Migration: fix existing WS requests that have method GET + ws:// URL
// ---------------------------------------------------------------------------

/// Scans all request YAML files and updates any that have `method: GET`
/// with a `ws://` or `wss://` URL to `method: WS`. Runs once (uses a
/// marker file to avoid re-scanning on every startup).
fn migrate_ws_method(dd: &DataDir) {
    use samvad_models::ApiRequest;

    let marker = dd.root().join(".migration_ws_method_done");
    if marker.exists() {
        return;
    }

    let workspaces_dir = dd.workspaces_dir();
    if !workspaces_dir.exists() {
        // Nothing to migrate
        let _ = std::fs::write(&marker, "done");
        return;
    }

    let mut updated = 0u32;

    if let Ok(ws_entries) = std::fs::read_dir(&workspaces_dir) {
        for ws_entry in ws_entries.flatten() {
            if !ws_entry.path().is_dir() {
                continue;
            }
            let collections_dir = ws_entry.path().join("collections");
            if !collections_dir.exists() {
                continue;
            }
            if let Ok(col_entries) = std::fs::read_dir(&collections_dir) {
                for col_entry in col_entries.flatten() {
                    let requests_dir = col_entry.path().join("requests");
                    if !requests_dir.exists() {
                        continue;
                    }
                    if let Ok(req_entries) = std::fs::read_dir(&requests_dir) {
                        for req_entry in req_entries.flatten() {
                            let path = req_entry.path();
                            if path.extension().and_then(|e| e.to_str()) != Some("yaml") {
                                continue;
                            }
                            // Try to read and fix the request
                            if let Ok(mut req) = read_yaml::<ApiRequest>(&path) {
                                let url_lower = req.url.trim().to_lowercase();
                                if req.method == HttpMethod::Get
                                    && (url_lower.starts_with("ws://")
                                        || url_lower.starts_with("wss://"))
                                {
                                    req.method = HttpMethod::Ws;
                                    if write_yaml(&path, &req).is_ok() {
                                        updated += 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if updated > 0 {
        println!("[migration] Updated {updated} WS request(s) from GET to WS method");
    }

    let _ = std::fs::write(&marker, "done");
}
