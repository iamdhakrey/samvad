use samvad_db::{new_id, now_iso, read_yaml, write_yaml, DataDir};
use samvad_error::AppResult;
use samvad_models::Workspace;

pub fn list_workspaces(dd: &DataDir) -> AppResult<Vec<Workspace>> {
    let ws_dir = dd.workspaces_dir();
    if !ws_dir.exists() {
        return Ok(Vec::new());
    }

    let mut workspaces = Vec::new();
    for entry in std::fs::read_dir(&ws_dir)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let meta_path = entry.path().join("workspace.yaml");
        if meta_path.exists() {
            let ws: Workspace = read_yaml(&meta_path)?;
            workspaces.push(ws);
        }
    }

    // Sort by created_at ASC to match previous SQLite ORDER BY
    workspaces.sort_by(|a, b| a.created_at.cmp(&b.created_at));
    Ok(workspaces)
}

pub fn create_workspace(dd: &DataDir, name: &str) -> AppResult<Workspace> {
    let workspace = Workspace {
        id: new_id(),
        name: name.to_string(),
        created_at: now_iso(),
        updated_at: now_iso(),
    };

    let ws_dir = dd.workspace_dir(&workspace.id);
    std::fs::create_dir_all(&ws_dir)?;
    write_yaml(&dd.workspace_meta_path(&workspace.id), &workspace)?;

    Ok(workspace)
}

pub fn rename_workspace(dd: &DataDir, id: &str, name: &str) -> AppResult<()> {
    let path = dd.workspace_meta_path(id);
    let mut ws: Workspace = read_yaml(&path)?;
    ws.name = name.to_string();
    ws.updated_at = now_iso();
    write_yaml(&path, &ws)
}

pub fn delete_workspace(dd: &DataDir, id: &str) -> AppResult<()> {
    let ws_dir = dd.workspace_dir(id);
    if ws_dir.exists() {
        std::fs::remove_dir_all(&ws_dir)?;
    }
    Ok(())
}
