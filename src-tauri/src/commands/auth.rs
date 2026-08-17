// ---------------------------------------------------------------------------
// Auth commands — Tauri command wrappers for the auth module
// ---------------------------------------------------------------------------

use samvad_error::{AppError, AppResult};
use samvad_models::{AuthState, PkceSession, User};
use std::sync::Arc;
use tauri::command;
use tauri::State;
use tokio::sync::Mutex;

use crate::state::AppState;
use samvad_auth as auth_core;

/// Shared in-memory PKCE session for the in-flight login attempt.
pub type PkceSessionState = Arc<Mutex<Option<PkceSession>>>;

/// Returns the current authenticated user, if any.
///
/// Validates stored tokens and refetches user info if needed.
#[command]
pub async fn get_current_user(state: State<'_, AppState>) -> AppResult<Option<User>> {
    let auth_state = auth_core::load_auth_state(&state.data_dir)?;
    match (&auth_state.user, &auth_state.tokens) {
        (Some(user), Some(tokens)) if auth_core::is_token_valid(tokens) => Ok(Some(user.clone())),
        (_, Some(tokens)) if auth_core::is_token_valid(tokens) => {
            // Have valid tokens but no cached user — re-fetch
            match auth_core::fetch_user_info(&tokens.access_token).await {
                Ok(user) => {
                    let new_state = AuthState {
                        user: Some(user.clone()),
                        tokens: Some(tokens.clone()),
                    };
                    auth_core::save_auth_state(&state.data_dir, &new_state)?;
                    Ok(Some(user))
                }
                Err(_) => Ok(None),
            }
        }
        _ => Ok(None),
    }
}

/// Returns the current access token if valid.
#[command]
pub async fn get_access_token(state: State<'_, AppState>) -> AppResult<Option<String>> {
    let auth_state = auth_core::load_auth_state(&state.data_dir)?;
    match auth_state.tokens {
        Some(tokens) if auth_core::is_token_valid(&tokens) => Ok(Some(tokens.access_token)),
        _ => Ok(None),
    }
}

/// Returns whether the user is currently authenticated.
#[command]
pub async fn is_authenticated(state: State<'_, AppState>) -> AppResult<bool> {
    let auth_state = auth_core::load_auth_state(&state.data_dir)?;
    match auth_state.tokens {
        Some(tokens) => Ok(auth_core::is_token_valid(&tokens)),
        None => Ok(false),
    }
}

/// Returns the stored auth state (tokens + user).
#[command]
pub async fn get_auth_state(state: State<'_, AppState>) -> AppResult<AuthState> {
    auth_core::load_auth_state(&state.data_dir)
}

/// Initiates the login flow.
///
/// 1. Generates PKCE verifier + challenge
/// 2. Returns the Auth0 authorize URL for the frontend to open
///
/// The frontend should call `start_server` (from tauri-plugin-oauth),
/// then open this URL in the browser. When the callback arrives,
/// the frontend calls `auth_handle_callback` with the callback URL.
#[command]
pub async fn auth_start_login(
    _state: State<'_, AppState>,
    pkce_state: State<'_, PkceSessionState>,
    loopback_uri: String,
) -> AppResult<String> {
    let verifier = auth_core::generate_random_string(64);
    let pkce_state_param = auth_core::generate_random_string(32);
    let challenge = auth_core::generate_code_challenge(&verifier);

    let session = PkceSession {
        state: pkce_state_param.clone(),
        code_verifier: verifier,
        loopback_uri: loopback_uri.clone(),
    };

    // Store in-flight session
    *pkce_state.lock().await = Some(session);

    let authorize_url =
        auth_core::build_authorize_url(&challenge, &pkce_state_param, &loopback_uri);
    Ok(authorize_url)
}

/// Handles the OAuth callback after the user completes login.
///
/// Parses the callback URL, validates state, exchanges the code for
/// tokens, fetches user info, and persists everything.
#[command]
pub async fn auth_handle_callback(
    state: State<'_, AppState>,
    pkce_state: State<'_, PkceSessionState>,
    callback_url: String,
) -> AppResult<AuthState> {
    let parsed = url::Url::parse(&callback_url)
        .map_err(|e| AppError::Invalid(format!("invalid callback URL: {e}")))?;

    // Check for error from Auth0
    if let Some(error) = parsed.query_pairs().find(|(k, _)| k == "error") {
        let desc = parsed
            .query_pairs()
            .find(|(k, _)| k == "error_description")
            .map(|(_, v)| v.to_string())
            .unwrap_or_else(|| error.1.to_string());
        return Err(AppError::Http(format!("authentication failed: {desc}")));
    }

    let code = parsed
        .query_pairs()
        .find(|(k, _)| k == "code")
        .map(|(_, v)| v.to_string())
        .ok_or_else(|| AppError::Invalid("missing 'code' in callback".into()))?;

    let returned_state = parsed
        .query_pairs()
        .find(|(k, _)| k == "state")
        .map(|(_, v)| v.to_string())
        .ok_or_else(|| AppError::Invalid("missing 'state' in callback".into()))?;

    // Retrieve and consume the PKCE session
    let session = pkce_state
        .lock()
        .await
        .take()
        .ok_or_else(|| AppError::Invalid("no pending login session".into()))?;

    // Validate state parameter
    if session.state != returned_state {
        return Err(AppError::Invalid("state mismatch — possible CSRF".into()));
    }

    // Exchange code for tokens
    let tokens =
        auth_core::exchange_code_for_tokens(&code, &session.code_verifier, &session.loopback_uri)
            .await?;

    // Fetch user info
    let user = auth_core::fetch_user_info(&tokens.access_token).await?;

    // Persist
    let auth_state = AuthState {
        user: Some(user),
        tokens: Some(tokens),
    };
    auth_core::save_auth_state(&state.data_dir, &auth_state)?;

    Ok(auth_state)
}

/// Logs out the user: revokes the token remotely, clears local state.
#[command]
pub async fn auth_logout(state: State<'_, AppState>) -> AppResult<String> {
    let auth_state = auth_core::load_auth_state(&state.data_dir)?;

    // Try to revoke remotely (ignore errors)
    if let Some(tokens) = &auth_state.tokens {
        let _ = auth_core::revoke_token(&tokens.access_token).await;
    }

    // Clear local state
    auth_core::clear_auth_state(&state.data_dir)?;

    // Return the Auth0 logout URL for the frontend to open
    let logout_url = format!(
        "https://{}/v2/logout?client_id={}&returnTo={}",
        auth_core::AUTH0_DOMAIN,
        auth_core::CLIENT_ID,
        urlencoding::encode(auth_core::REDIRECT_URI),
    );
    Ok(logout_url)
}
