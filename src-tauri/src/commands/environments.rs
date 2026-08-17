use samvad_error::AppResult;
use tauri::State;

use crate::state::AppState;
use samvad_models::{Environment, EnvironmentVariable, EnvironmentWithVariables};

#[tauri::command]
pub async fn list_environments(
    state: State<'_, AppState>,
    workspaceid: String,
) -> AppResult<Vec<EnvironmentWithVariables>> {
    crate::db::environments::list_environments(&state.data_dir, &workspaceid)
}

#[tauri::command]
pub async fn list_variables(
    state: State<'_, AppState>,
    workspaceid: String,
    environmentid: String,
) -> AppResult<Vec<EnvironmentVariable>> {
    crate::db::environments::list_variables(&state.data_dir, &workspaceid, &environmentid)
}

#[tauri::command]
pub async fn create_environment(
    state: State<'_, AppState>,
    workspaceid: String,
    name: String,
) -> AppResult<Environment> {
    crate::db::environments::create_environment(&state.data_dir, &workspaceid, &name)
}

#[tauri::command]
pub async fn rename_environment(
    state: State<'_, AppState>,
    environmentid: String,
    name: String,
) -> AppResult<()> {
    crate::db::environments::rename_environment(&state.data_dir, &environmentid, &name)
}

#[tauri::command]
pub async fn delete_environment(
    state: State<'_, AppState>,
    environmentid: String,
) -> AppResult<()> {
    crate::db::environments::delete_environment(&state.data_dir, &environmentid)
}

#[tauri::command]
pub async fn replace_variables(
    state: State<'_, AppState>,
    environmentid: String,
    variables: Vec<EnvironmentVariable>,
) -> AppResult<()> {
    crate::db::environments::replace_variables(&state.data_dir, &environmentid, &variables)
}

/// Persists the active environment selection to `app_state.yaml`.
/// Pass `null` / `None` from the frontend to clear the active environment.
#[tauri::command]
pub async fn set_active_environment(
    state: State<'_, AppState>,
    environmentid: Option<String>,
) -> AppResult<()> {
    crate::db::app_state::set_active_environment(&state.data_dir, environmentid.as_deref())
}
