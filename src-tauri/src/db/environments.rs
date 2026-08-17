use std::collections::HashMap;

use samvad_db::{new_id, read_yaml_vec, write_yaml, DataDir};
use samvad_error::AppResult;
use samvad_models::{Environment, EnvironmentVariable, EnvironmentWithVariables};

pub fn list_environments(
    dd: &DataDir,
    workspace_id: &str,
) -> AppResult<Vec<EnvironmentWithVariables>> {
    let path = dd.environments_path(workspace_id);
    let mut envs: Vec<EnvironmentWithVariables> = read_yaml_vec(&path)?;
    // Sort by sort_order ASC
    envs.sort_by_key(|e| e.environment.sort_order);
    Ok(envs)
}

pub fn list_variables(
    dd: &DataDir,
    workspace_id: &str,
    environment_id: &str,
) -> AppResult<Vec<EnvironmentVariable>> {
    let envs = list_environments(dd, workspace_id)?;
    Ok(envs
        .into_iter()
        .find(|e| e.environment.id == environment_id)
        .map(|e| e.variables)
        .unwrap_or_default())
}

/// Find which workspace an environment belongs to by scanning all
/// workspace environment files.
fn find_environment_workspace(dd: &DataDir, environment_id: &str) -> AppResult<String> {
    let ws_dir = dd.workspaces_dir();
    if ws_dir.exists() {
        for entry in std::fs::read_dir(&ws_dir)? {
            let entry = entry?;
            if !entry.file_type()?.is_dir() {
                continue;
            }
            let ws_id = entry.file_name().to_string_lossy().to_string();
            let envs_path = dd.environments_path(&ws_id);
            if envs_path.exists() {
                let envs: Vec<EnvironmentWithVariables> = read_yaml_vec(&envs_path)?;
                if envs.iter().any(|e| e.environment.id == environment_id) {
                    return Ok(ws_id);
                }
            }
        }
    }
    Err(samvad_error::AppError::NotFound(format!(
        "environment '{environment_id}'"
    )))
}

pub fn create_environment(dd: &DataDir, workspace_id: &str, name: &str) -> AppResult<Environment> {
    let environment = Environment {
        id: new_id(),
        workspace_id: workspace_id.to_string(),
        name: name.to_string(),
        sort_order: 0,
    };

    let path = dd.environments_path(workspace_id);
    let mut envs: Vec<EnvironmentWithVariables> = read_yaml_vec(&path)?;
    envs.push(EnvironmentWithVariables {
        environment: environment.clone(),
        variables: Vec::new(),
    });
    write_yaml(&path, &envs)?;

    Ok(environment)
}

pub fn rename_environment(dd: &DataDir, id: &str, name: &str) -> AppResult<()> {
    let ws_id = find_environment_workspace(dd, id)?;
    let path = dd.environments_path(&ws_id);
    let mut envs: Vec<EnvironmentWithVariables> = read_yaml_vec(&path)?;
    if let Some(env) = envs.iter_mut().find(|e| e.environment.id == id) {
        env.environment.name = name.to_string();
    }
    write_yaml(&path, &envs)
}

pub fn delete_environment(dd: &DataDir, id: &str) -> AppResult<()> {
    let ws_id = find_environment_workspace(dd, id)?;
    let path = dd.environments_path(&ws_id);
    let mut envs: Vec<EnvironmentWithVariables> = read_yaml_vec(&path)?;
    envs.retain(|e| e.environment.id != id);
    write_yaml(&path, &envs)
}

/// Replaces every variable for an environment with the given set — the
/// frontend always edits the whole variable table at once (see the
/// Environment editor), so a clear-then-insert is simpler and avoids
/// reconciling row-level diffs.
pub fn replace_variables(
    dd: &DataDir,
    environment_id: &str,
    variables: &[EnvironmentVariable],
) -> AppResult<()> {
    let ws_id = find_environment_workspace(dd, environment_id)?;
    let path = dd.environments_path(&ws_id);
    let mut envs: Vec<EnvironmentWithVariables> = read_yaml_vec(&path)?;

    if let Some(env) = envs.iter_mut().find(|e| e.environment.id == environment_id) {
        env.variables = variables
            .iter()
            .enumerate()
            .map(|(_i, v)| {
                let mut var = v.clone();
                if var.id.is_empty() {
                    var.id = new_id();
                }
                var.environmentid = environment_id.to_string();
                var
            })
            .collect();
    }

    write_yaml(&path, &envs)
}

/// Loads the active environment's enabled variables as a flat map, ready
/// for `interpolate`. Returns an empty map if no environment is active.
pub fn active_variable_map(
    dd: &DataDir,
    active_environment_id: Option<&str>,
) -> AppResult<HashMap<String, String>> {
    let Some(env_id) = active_environment_id else {
        return Ok(HashMap::new());
    };
    // We need to find the workspace for this environment
    let ws_id = match find_environment_workspace(dd, env_id) {
        Ok(id) => id,
        Err(_) => return Ok(HashMap::new()),
    };
    let vars = list_variables(dd, &ws_id, env_id)?;
    Ok(vars
        .into_iter()
        .filter(|v| v.enabled)
        .map(|v| (v.key, v.value))
        .collect())
}

/// Replaces every `{{key}}` placeholder in `input` with the matching
/// variable value. Unmatched placeholders are left as-is rather than
/// silently emptied, so a typo'd variable name is obvious in the sent
/// request instead of producing an empty string.
pub fn interpolate(input: &str, variables: &HashMap<String, String>) -> String {
    if !input.contains("{{") {
        return input.to_string();
    }

    let mut output = String::with_capacity(input.len());
    let mut rest = input;

    while let Some(start) = rest.find("{{") {
        output.push_str(&rest[..start]);
        let after_start = &rest[start + 2..];

        match after_start.find("}}") {
            Some(end) => {
                let key = after_start[..end].trim();
                match variables.get(key) {
                    Some(value) => output.push_str(value),
                    None => {
                        output.push_str("{{");
                        output.push_str(key);
                        output.push_str("}}");
                    }
                }
                rest = &after_start[end + 2..];
            }
            None => {
                // Unterminated `{{` — treat the rest of the string literally.
                output.push_str("{{");
                rest = after_start;
                break;
            }
        }
    }

    output.push_str(rest);
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interpolates_known_keys_and_preserves_unknown_ones() {
        let mut vars = HashMap::new();
        vars.insert(
            "base_url".to_string(),
            "https://api.example.com".to_string(),
        );

        let result = interpolate("{{base_url}}/users/{{user_id}}", &vars);
        assert_eq!(result, "https://api.example.com/users/{{user_id}}");
    }

    #[test]
    fn leaves_plain_strings_untouched() {
        let vars = HashMap::new();
        assert_eq!(
            interpolate("no placeholders here", &vars),
            "no placeholders here"
        );
    }
}
