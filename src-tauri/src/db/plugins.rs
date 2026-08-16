use serde::{Deserialize, Serialize};

use samvad_db::{now_iso, read_yaml_vec, write_yaml, DataDir};
use samvad_error::{AppError, AppResult};
use samvad_models::{PluginManifest, PluginRecord};

/// YAML-persisted plugin entry (replaces the old SQL row).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginEntry {
    id: String,
    name: String,
    version: String,
    description: String,
    enabled: bool,
    install_path: String,
    manifest_json: String,
    installed_at: String,
}

impl PluginEntry {
    fn into_record(self) -> AppResult<PluginRecord> {
        let manifest: PluginManifest = serde_json::from_str(&self.manifest_json)?;
        Ok(PluginRecord {
            id: self.id,
            name: self.name,
            version: self.version,
            description: self.description,
            enabled: self.enabled,
            install_path: self.install_path,
            hooks: manifest.hooks,
            installed_at: self.installed_at,
        })
    }
}

pub fn list_plugins(dd: &DataDir) -> AppResult<Vec<PluginRecord>> {
    let entries: Vec<PluginEntry> = read_yaml_vec(&dd.plugins_path())?;
    let mut records: Vec<PluginRecord> = entries
        .into_iter()
        .map(PluginEntry::into_record)
        .collect::<Result<Vec<_>, _>>()?;
    records.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(records)
}

pub fn list_enabled_plugins_with_source(dd: &DataDir) -> AppResult<Vec<(PluginManifest, String)>> {
    let entries: Vec<PluginEntry> = read_yaml_vec(&dd.plugins_path())?;

    let mut out = Vec::new();
    for entry in entries.into_iter().filter(|e| e.enabled) {
        let manifest: PluginManifest = serde_json::from_str(&entry.manifest_json)?;
        let entry_path = std::path::Path::new(&entry.install_path).join(&manifest.entry);
        let source = std::fs::read_to_string(&entry_path).map_err(|e| {
            AppError::Other(format!(
                "failed to read entry script for plugin '{}' at {}: {e}",
                manifest.id,
                entry_path.display()
            ))
        })?;
        out.push((manifest, source));
    }
    Ok(out)
}

/// Registers a plugin already unpacked on disk at `install_path`
/// (containing `manifest.json`). Re-running with the same manifest id
/// upserts — lets `install_plugin` double as "reinstall/update".
pub fn upsert_plugin(
    dd: &DataDir,
    manifest: &PluginManifest,
    install_path: &str,
) -> AppResult<PluginRecord> {
    let manifest_json = serde_json::to_string(manifest)?;
    let mut entries: Vec<PluginEntry> = read_yaml_vec(&dd.plugins_path())?;

    if let Some(existing) = entries.iter_mut().find(|e| e.id == manifest.id) {
        existing.name = manifest.name.clone();
        existing.version = manifest.version.clone();
        existing.description = manifest.description.clone();
        existing.install_path = install_path.to_string();
        existing.manifest_json = manifest_json;
    } else {
        entries.push(PluginEntry {
            id: manifest.id.clone(),
            name: manifest.name.clone(),
            version: manifest.version.clone(),
            description: manifest.description.clone(),
            enabled: true,
            install_path: install_path.to_string(),
            manifest_json,
            installed_at: now_iso(),
        });
    }

    write_yaml(&dd.plugins_path(), &entries)?;

    // Return the record we just wrote
    let entry = entries
        .into_iter()
        .find(|e| e.id == manifest.id)
        .expect("we just inserted it");
    entry.into_record()
}

pub fn set_plugin_enabled(dd: &DataDir, id: &str, enabled: bool) -> AppResult<()> {
    let mut entries: Vec<PluginEntry> = read_yaml_vec(&dd.plugins_path())?;
    if let Some(entry) = entries.iter_mut().find(|e| e.id == id) {
        entry.enabled = enabled;
    }
    write_yaml(&dd.plugins_path(), &entries)
}

pub fn get_plugin_install_path(dd: &DataDir, id: &str) -> AppResult<String> {
    let entries: Vec<PluginEntry> = read_yaml_vec(&dd.plugins_path())?;
    entries
        .into_iter()
        .find(|e| e.id == id)
        .map(|e| e.install_path)
        .ok_or_else(|| AppError::NotFound(format!("plugin '{id}'")))
}

pub fn delete_plugin(dd: &DataDir, id: &str) -> AppResult<()> {
    let mut entries: Vec<PluginEntry> = read_yaml_vec(&dd.plugins_path())?;
    entries.retain(|e| e.id != id);
    write_yaml(&dd.plugins_path(), &entries)
}
