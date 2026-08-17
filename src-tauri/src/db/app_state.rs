use samvad_db::{read_yaml_or_default, write_yaml, DataDir};
use samvad_error::AppResult;
use samvad_models::ActiveState;

pub fn get_active_state(dd: &DataDir) -> AppResult<ActiveState> {
    read_yaml_or_default(&dd.app_state_path())
}

pub fn set_active_workspace(dd: &DataDir, workspace_id: &str) -> AppResult<()> {
    let mut state = get_active_state(dd)?;
    state.active_workspace_id = Some(workspace_id.to_string());
    write_yaml(&dd.app_state_path(), &state)
}

pub fn set_active_environment(dd: &DataDir, environment_id: Option<&str>) -> AppResult<()> {
    let mut state = get_active_state(dd)?;
    state.active_environment_id = environment_id.map(str::to_string);
    write_yaml(&dd.app_state_path(), &state)
}

pub fn set_active_theme(dd: &DataDir, theme_id: &str) -> AppResult<()> {
    let mut state = get_active_state(dd)?;
    state.active_theme_id = Some(theme_id.to_string());
    write_yaml(&dd.app_state_path(), &state)
}

pub fn set_active_request(dd: &DataDir, request_id: Option<&str>) -> AppResult<()> {
    let mut state = get_active_state(dd)?;
    state.active_request_id = request_id.map(str::to_string);
    write_yaml(&dd.app_state_path(), &state)
}

pub fn set_active_collection(dd: &DataDir, collection_id: Option<&str>) -> AppResult<()> {
    let mut state = get_active_state(dd)?;
    state.active_collection_id = collection_id.map(str::to_string);
    write_yaml(&dd.app_state_path(), &state)
}
