use samvad_db::{read_yaml_or_default, write_yaml, DataDir};
use samvad_error::AppResult;
use samvad_models::AppSettings;

pub fn get_settings(dd: &DataDir) -> AppResult<AppSettings> {
    read_yaml_or_default(&dd.settings_path())
}

pub fn update_settings(dd: &DataDir, settings: &AppSettings) -> AppResult<()> {
    write_yaml(&dd.settings_path(), settings)
}
