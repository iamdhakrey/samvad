use samvad_db::{read_yaml_vec, write_yaml, DataDir};
use samvad_error::{AppError, AppResult};
use samvad_models::{Theme, ThemeTokens};

pub fn list_themes(dd: &DataDir) -> AppResult<Vec<Theme>> {
    let mut themes: Vec<Theme> = read_yaml_vec(&dd.themes_path())?;
    // Built-in themes first, then alphabetical
    themes.sort_by(|a, b| {
        b.is_builtin
            .cmp(&a.is_builtin)
            .then_with(|| a.name.cmp(&b.name))
    });
    Ok(themes)
}

pub fn get_theme(dd: &DataDir, id: &str) -> AppResult<Theme> {
    let themes = list_themes(dd)?;
    themes
        .into_iter()
        .find(|t| t.id == id)
        .ok_or_else(|| AppError::NotFound(format!("theme '{id}'")))
}

pub fn save_custom_theme(
    dd: &DataDir,
    id: Option<&str>,
    name: &str,
    tokens: &ThemeTokens,
) -> AppResult<Theme> {
    let id = id.map(str::to_string).unwrap_or_else(samvad_db::new_id);
    let mut themes: Vec<Theme> = read_yaml_vec(&dd.themes_path())?;

    if let Some(existing) = themes.iter_mut().find(|t| t.id == id) {
        if existing.is_builtin {
            // Silently skip — can't modify built-ins, matching old SQLite
            // WHERE clause behavior.
            return Ok(existing.clone());
        }
        existing.name = name.to_string();
        existing.tokens = tokens.clone();
    } else {
        themes.push(Theme {
            id: id.clone(),
            name: name.to_string(),
            is_builtin: false,
            tokens: tokens.clone(),
        });
    }

    write_yaml(&dd.themes_path(), &themes)?;
    get_theme(dd, &id)
}

pub fn delete_theme(dd: &DataDir, id: &str) -> AppResult<()> {
    let theme = get_theme(dd, id)?;
    if theme.is_builtin {
        return Err(AppError::Invalid(
            "built-in themes can't be deleted".to_string(),
        ));
    }
    let mut themes: Vec<Theme> = read_yaml_vec(&dd.themes_path())?;
    themes.retain(|t| t.id != id);
    write_yaml(&dd.themes_path(), &themes)
}
