use font_kit::source::SystemSource;
use tauri::command;

#[command]
pub fn get_system_fonts() -> Result<Vec<String>, String> {
    let source = SystemSource::new();
    let mut font_names = source.all_families().map_err(|e| e.to_string())?;

    font_names.sort();
    font_names.dedup();

    Ok(font_names)
}
