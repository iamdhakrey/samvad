use tauri::Manager;

use crate::commands::collections::{
    clone_collection, create_collection, create_folder, create_request, create_ws_request,
    delete_collection, delete_folder, delete_request, duplicate_request, get_collection_trees,
    get_request, rename_collection, rename_folder, rename_request, save_request,
};
use crate::commands::environments::{
    create_environment, delete_environment, list_environments, list_variables, rename_environment,
    replace_variables, set_active_environment,
};
use crate::commands::settings::{get_settings, update_settings};
use crate::commands::workspaces::{
    create_workspace, delete_workspace, get_active_state, get_active_state_full, list_workspaces,
    rename_workspace, set_active_workspace,
};
use crate::http::send_request;
use crate::state::AppState;
use crate::ws::{
    ws_add_saved_message, ws_connect, ws_delete_saved_message, ws_disconnect,
    ws_list_saved_messages, ws_send, ws_update_saved_message,
};

use crate::commands::history::{clear_history, delete_history_entry, list_history};

mod commands;
pub mod db;
mod error;
mod http;
mod models;
mod state;
pub mod ws;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            let data_dir = app_handle
                .path()
                .app_data_dir()
                .expect("resolve app data dir");
            std::fs::create_dir_all(&data_dir).expect("create app data dir");

            let data_dir = db::init_data_dir(&data_dir).expect("initialize data directory");

            app_handle.manage(AppState {
                data_dir,
                ws_connections: Default::default(),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            send_request,
            list_workspaces,
            create_workspace,
            rename_workspace,
            delete_workspace,
            set_active_workspace,
            get_active_state,
            get_active_state_full,
            //  Collection commands
            get_collection_trees,
            create_collection,
            rename_collection,
            delete_collection,
            clone_collection,
            // Folder commands
            create_folder,
            rename_folder,
            delete_folder,
            // Request commands
            create_request,
            create_ws_request,
            rename_request,
            delete_request,
            get_request,
            duplicate_request,
            save_request,
            // Settings
            get_settings,
            update_settings,
            // Environment commands
            create_environment,
            rename_environment,
            delete_environment,
            list_environments,
            list_variables,
            replace_variables,
            set_active_environment,
            // WebSocket commands
            ws_connect,
            ws_send,
            ws_disconnect,
            ws_list_saved_messages,
            ws_add_saved_message,
            ws_update_saved_message,
            ws_delete_saved_message,
            // History commands
            // add_entry,
            list_history,
            clear_history,
            delete_history_entry
        ])
        .run(tauri::generate_context!())
        .expect("error while running Samvad application");
}
