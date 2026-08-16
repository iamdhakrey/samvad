use samvad_db::{new_id, read_yaml_vec, write_yaml, DataDir};
use samvad_error::AppResult;
use samvad_models::WsSavedMessage;

/// Return all saved message templates for a given request.
pub fn list_saved_messages(dd: &DataDir, request_id: &str) -> AppResult<Vec<WsSavedMessage>> {
    read_yaml_vec(&dd.ws_saved_messages_path(request_id))
}

/// Add a new saved message template.
pub fn add_saved_message(
    dd: &DataDir,
    request_id: &str,
    name: &str,
    data: &str,
) -> AppResult<WsSavedMessage> {
    let msg = WsSavedMessage {
        id: new_id(),
        name: name.to_string(),
        data: data.to_string(),
    };

    let mut messages = list_saved_messages(dd, request_id)?;
    messages.push(msg.clone());
    write_yaml(&dd.ws_saved_messages_path(request_id), &messages)?;

    Ok(msg)
}

/// Update an existing saved message template.
pub fn update_saved_message(
    dd: &DataDir,
    request_id: &str,
    message: &WsSavedMessage,
) -> AppResult<()> {
    let mut messages = list_saved_messages(dd, request_id)?;
    if let Some(existing) = messages.iter_mut().find(|m| m.id == message.id) {
        existing.name = message.name.clone();
        existing.data = message.data.clone();
    }
    write_yaml(&dd.ws_saved_messages_path(request_id), &messages)
}

/// Delete a saved message template by id.
pub fn delete_saved_message(dd: &DataDir, request_id: &str, message_id: &str) -> AppResult<()> {
    let messages: Vec<WsSavedMessage> = list_saved_messages(dd, request_id)?
        .into_iter()
        .filter(|m| m.id != message_id)
        .collect();
    write_yaml(&dd.ws_saved_messages_path(request_id), &messages)
}
