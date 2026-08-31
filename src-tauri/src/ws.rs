use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use rustls::ClientConfig;
use tauri::{AppHandle, Emitter, State};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::{connect_async_tls_with_config, Connector};

use crate::db;
use crate::state::AppState;
use samvad_error::{AppError, AppResult};
use samvad_models::{AppSettings, WsEvent, WsSavedMessage};

use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerifier};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{Error, SignatureScheme};

#[derive(Debug)]
struct NoCertificateVerification;

impl ServerCertVerifier for NoCertificateVerification {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, Error> {
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        rustls::crypto::aws_lc_rs::default_provider()
            .signature_verification_algorithms
            .supported_schemes()
    }
}
fn build_ws_client(setting: &AppSettings) -> AppResult<Connector> {
    let mut config = ClientConfig::builder()
        .with_root_certificates(rustls::RootCertStore::empty())
        .with_no_client_auth();

    if !setting.verify_ssl_certificates {
        config
            .dangerous()
            .set_certificate_verifier(Arc::new(NoCertificateVerification));
    };

    // 3. Wrap it inside tokio_tungstenite's Connector enum
    let connector = Connector::Rustls(Arc::new(config));
    Ok(connector)
}

fn check_is_secure_ws(url: String) -> bool {
    return url.starts_with("wss");
}
// -----------------------------------------------------------------------
// Connect
// -----------------------------------------------------------------------

/// Opens a WebSocket connection in a background task.
///
/// Returns a `connection_id` (a UUID) the frontend uses for all
/// subsequent `ws_send` / `ws_disconnect` calls.  Incoming server
/// messages are pushed to the frontend via the `ws://message` Tauri
/// event — the frontend doesn't need to poll.
#[tauri::command]
pub async fn ws_connect(
    app: AppHandle,
    state: State<'_, AppState>,
    url: String,
    headers: Vec<(String, String)>,
) -> AppResult<String> {
    // Build the WS request with custom headers.
    let dd = &state.data_dir;

    let settings = db::settings::get_settings(dd)?;
    let mut request = url
        .clone()
        .into_client_request()
        .map_err(|e| AppError::WebSocket(format!("invalid websocket URL: {e}")))?;

    for (key, value) in &headers {
        let header_name = key
            .parse::<http::header::HeaderName>()
            .map_err(|e| AppError::WebSocket(format!("invalid header name '{key}': {e}")))?;
        let header_value = value
            .parse::<http::header::HeaderValue>()
            .map_err(|e| AppError::WebSocket(format!("invalid header value for '{key}': {e}")))?;
        request.headers_mut().insert(header_name, header_value);
    }

    let connector = build_ws_client(&settings)?;
    let (ws_stream, _response) = if check_is_secure_ws(url.clone()) {
        connect_async_tls_with_config(
            url.clone(),
            None,  // Use default WebSocketConfig
            false, // Do not disable Nagle's algorithm
            Some(connector),
        )
        .await
        .map_err(|e| AppError::WebSocket(format!("TLS connection failed: {e}")))?
    } else {
        tokio_tungstenite::connect_async(request)
            .await
            .map_err(|e| AppError::WebSocket(format!("connection failed: {e}")))?
    };

    let (mut write, mut read) = ws_stream.split();

    let connection_id = samvad_db::new_id();
    let cid = connection_id.clone();

    // Create an mpsc channel: the `ws_send` command writes to `tx`,
    // the background task reads from `rx` and forwards to the socket.
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();

    // Store the sender half so `ws_send` can find it later.
    state
        .ws_connections
        .lock()
        .await
        .insert(connection_id.clone(), tx);

    let connections = state.ws_connections.clone();
    let cid_for_task = cid.clone();

    // Spawn the background read/write loop.
    tokio::spawn(async move {
        loop {
            tokio::select! {
                // Forward outgoing messages from the channel to the socket.
                Some(msg) = rx.recv() => {
                    if write.send(msg).await.is_err() {
                        break;
                    }
                }
                // Forward incoming messages from the socket to the frontend.
                frame = read.next() => {
                    match frame {
                        Some(Ok(msg)) => {
                            if msg.is_close() {
                                let _ = app.emit("ws://message", WsEvent {
                                    connection_id: cid_for_task.clone(),
                                    direction: "closed".to_string(),
                                    data: String::new(),
                                    timestamp: samvad_db::now_iso(),
                                });
                                break;
                            }
                            if msg.is_text() || msg.is_binary() {
                                let data = msg.to_text()
                                    .map(|s| s.to_string())
                                    .unwrap_or_else(|_| format!("<binary {} bytes>", msg.len()));
                                let _ = app.emit("ws://message", WsEvent {
                                    connection_id: cid_for_task.clone(),
                                    direction: "received".to_string(),
                                    data,
                                    timestamp: samvad_db::now_iso(),
                                });
                            }
                        }
                        Some(Err(_)) | None => break,
                    }
                }
            }
        }

        // Cleanup: remove the connection from the map when the loop ends.
        connections.lock().await.remove(&cid_for_task);

        // Notify the frontend that the connection has been closed.
        let _ = app.emit(
            "ws://status",
            serde_json::json!({
                "connectionId": cid_for_task,
                "status": "disconnected",
            }),
        );
    });

    Ok(cid)
}

// -----------------------------------------------------------------------
// Send
// -----------------------------------------------------------------------

/// Sends a text message through an existing WebSocket connection.
///
/// Also emits a `ws://message` event with `direction: "sent"` so the
/// frontend message log stays in sync.
#[tauri::command]
pub async fn ws_send(
    app: AppHandle,
    state: State<'_, AppState>,
    connection_id: String,
    message: String,
) -> AppResult<()> {
    let connections = state.ws_connections.lock().await;
    let tx = connections
        .get(&connection_id)
        .ok_or_else(|| AppError::WebSocket("connection not found (may have been closed)".into()))?;

    tx.send(tokio_tungstenite::tungstenite::Message::Text(
        message.clone().into(),
    ))
    .map_err(|e| AppError::WebSocket(format!("failed to send: {e}")))?;

    // Echo to the frontend so the sent message appears in the log.
    let _ = app.emit(
        "ws://message",
        WsEvent {
            connection_id,
            direction: "sent".to_string(),
            data: message,
            timestamp: samvad_db::now_iso(),
        },
    );

    Ok(())
}

// -----------------------------------------------------------------------
// Disconnect
// -----------------------------------------------------------------------

/// Gracefully closes an active WebSocket connection.
#[tauri::command]
pub async fn ws_disconnect(state: State<'_, AppState>, connection_id: String) -> AppResult<()> {
    let mut connections = state.ws_connections.lock().await;
    if let Some(tx) = connections.remove(&connection_id) {
        // Send a close frame.  If the channel is already closed the
        // error is harmless — the background task has already exited.
        let _ = tx.send(tokio_tungstenite::tungstenite::Message::Close(None));
    }
    Ok(())
}

// -----------------------------------------------------------------------
// Saved message templates (persisted CRUD)
// -----------------------------------------------------------------------

#[tauri::command]
pub async fn ws_list_saved_messages(
    state: State<'_, AppState>,
    request_id: String,
) -> AppResult<Vec<WsSavedMessage>> {
    db::ws_messages::list_saved_messages(&state.data_dir, &request_id)
}

#[tauri::command]
pub async fn ws_add_saved_message(
    state: State<'_, AppState>,
    request_id: String,
    name: String,
    data: String,
) -> AppResult<WsSavedMessage> {
    db::ws_messages::add_saved_message(&state.data_dir, &request_id, &name, &data)
}

#[tauri::command]
pub async fn ws_update_saved_message(
    state: State<'_, AppState>,
    request_id: String,
    message: WsSavedMessage,
) -> AppResult<()> {
    db::ws_messages::update_saved_message(&state.data_dir, &request_id, &message)
}

#[tauri::command]
pub async fn ws_delete_saved_message(
    state: State<'_, AppState>,
    request_id: String,
    message_id: String,
) -> AppResult<()> {
    db::ws_messages::delete_saved_message(&state.data_dir, &request_id, &message_id)
}
