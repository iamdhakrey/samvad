use crate::{db, state::AppState};
use samvad_error::AppResult;
use samvad_models::{ActiveState, Workspace};
use tauri::State;

#[tauri::command]
pub async fn list_workspaces(state: State<'_, AppState>) -> AppResult<Vec<Workspace>> {
    db::workspaces::list_workspaces(&state.data_dir)
}

#[tauri::command]
pub async fn create_workspace(state: State<'_, AppState>, name: String) -> AppResult<Workspace> {
    db::workspaces::create_workspace(&state.data_dir, &name)
}

#[tauri::command]
pub async fn rename_workspace(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> AppResult<()> {
    db::workspaces::rename_workspace(&state.data_dir, &id, &name)
}

#[tauri::command]
pub async fn delete_workspace(state: State<'_, AppState>, id: String) -> AppResult<()> {
    db::workspaces::delete_workspace(&state.data_dir, &id)
}

#[tauri::command]
pub async fn set_active_workspace(state: State<'_, AppState>, id: String) -> AppResult<()> {
    db::app_state::set_active_workspace(&state.data_dir, &id)
}

/// Returns the active workspace object (for the sidebar workspace selector).
#[tauri::command]
pub async fn get_active_state(state: State<'_, AppState>) -> AppResult<Option<Workspace>> {
    db::app_state::get_active_state(&state.data_dir).and_then(|active_state| {
        if let Some(workspace_id) = active_state.active_workspace_id {
            println!("Active workspace ID: {}", workspace_id);
            db::workspaces::list_workspaces(&state.data_dir)
                .map(|workspaces| workspaces.into_iter().find(|ws| ws.id == workspace_id))
        } else {
            Ok(None)
        }
    })
}

/// Returns the full persisted active state (workspace + environment + theme IDs).
/// Use this on app startup to restore the user's previous selections.
#[tauri::command]
pub async fn get_active_state_full(state: State<'_, AppState>) -> AppResult<ActiveState> {
    db::app_state::get_active_state(&state.data_dir)
}
