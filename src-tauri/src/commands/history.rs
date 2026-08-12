use crate::{models::HistoryEntry, state::AppState};
use tauri::State;

#[tauri::command]
pub async fn list_history(
    state: State<'_, AppState>,
    limit: i64,
) -> crate::error::AppResult<Vec<HistoryEntry>> {
    crate::db::history::list_history(&state.data_dir, limit)
}

#[tauri::command]
pub async fn clear_history(state: State<'_, AppState>) -> crate::error::AppResult<()> {
    crate::db::history::clear_history(&state.data_dir)
}

#[tauri::command]
pub async fn delete_history_entry(
    state: State<'_, AppState>,
    id: String,
) -> crate::error::AppResult<()> {
    crate::db::history::delete_entry(&state.data_dir, &id)
}
