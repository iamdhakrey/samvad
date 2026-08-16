// ---------------------------------------------------------------------------
// Auth module — PKCE-based Auth0 OAuth flow, token management, JWT parsing
//
// This replaces the TS files: useAuth0Desktop.ts, userService.ts, tokenStore.ts
// ---------------------------------------------------------------------------

use rand::RngExt;
use samvad_models::{AuthState, AuthTokens, User};
use serde::Deserialize;
use sha2::{Digest, Sha256};

use samvad_db::{DataDir, read_yaml_or_default, write_yaml};
use samvad_error::{AppError, AppResult};

// ── Configuration ───────────────────────────────────────────────────────

pub const AUTH0_DOMAIN: &str = "dev-q8fu8sev1deljwdb.us.auth0.com";
pub const CLIENT_ID: &str = "tMfu0Y4XuUixvOMfkB3xsKm5Wf87ZSQP";
pub const REDIRECT_URI: &str = "https://samvad.iamdhakrey.dev";

// ── Models ──────────────────────────────────────────────────────────────
/// Auth0 `/oauth/token` response shape.
#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    id_token: Option<String>,
    expires_in: u64,
}

/// Auth0 `/userinfo` response shape.
#[derive(Debug, Deserialize)]
struct UserInfoResponse {
    sub: String,
    name: Option<String>,
    email: Option<String>,
    picture: Option<String>,
    updated_at: Option<String>,
}

// ── PKCE Utilities ──────────────────────────────────────────────────────

const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

/// Generates a cryptographically random string of the given length using
/// characters from the PKCE-safe charset (RFC 7636 §4.1).
pub fn generate_random_string(length: usize) -> String {
    let mut rng = rand::rng();
    (0..length)
        .map(|_| {
            let idx = rng.random_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

/// Computes the S256 PKCE code challenge from a code verifier.
pub fn generate_code_challenge(verifier: &str) -> String {
    let hash = Sha256::digest(verifier.as_bytes());
    base64_url_encode(&hash)
}

fn base64_url_encode(bytes: &[u8]) -> String {
    use base64::Engine;
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    URL_SAFE_NO_PAD.encode(bytes)
}

// ── JWT Parsing ─────────────────────────────────────────────────────────

/// Minimal JWT payload fields we care about.
#[derive(Debug, Deserialize)]
struct JwtClaims {
    exp: Option<u64>,
}

/// Extracts the `exp` claim from a JWT without verifying the signature
/// (we trust Auth0's token since we already verified it over TLS).
fn parse_jwt_exp(token: &str) -> Option<u64> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return None;
    }
    use base64::Engine;
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;

    // JWT base64url may need padding
    let payload_b64 = parts[1];
    let decoded = URL_SAFE_NO_PAD.decode(payload_b64).ok()?;
    let claims: JwtClaims = serde_json::from_slice(&decoded).ok()?;
    claims.exp
}

// ── Persistence ─────────────────────────────────────────────────────────

trait AuthPath {
    fn auth_path(&self) -> std::path::PathBuf;
}

impl AuthPath for DataDir {
    fn auth_path(&self) -> std::path::PathBuf {
        self.root().join("auth.yaml")
    }
}

pub fn load_auth_state(dd: &DataDir) -> AppResult<AuthState> {
    read_yaml_or_default(&dd.auth_path())
}

pub fn save_auth_state(dd: &DataDir, state: &AuthState) -> AppResult<()> {
    write_yaml(&dd.auth_path(), state)
}

pub fn clear_auth_state(dd: &DataDir) -> AppResult<()> {
    save_auth_state(dd, &AuthState::default())
}

// ── Auth0 API calls ─────────────────────────────────────────────────────

/// Builds the Auth0 `/authorize` URL that the browser should be opened to.
pub fn build_authorize_url(code_challenge: &str, state: &str, redirect_uri: &str) -> String {
    println!("Build Auth Url");
    format!(
        "https://{}/authorize?\
         client_id={}&\
         response_type=code&\
         code_challenge={}&\
         code_challenge_method=S256&\
         redirect_uri={}&\
         scope=openid%20profile%20email%20offline_access&\
         state={}",
        AUTH0_DOMAIN,
        CLIENT_ID,
        code_challenge,
        urlencoding::encode(redirect_uri),
        state,
    )
}

/// Exchanges an authorization code for tokens via Auth0's `/oauth/token`.
pub async fn exchange_code_for_tokens(
    code: &str,
    code_verifier: &str,
    redirect_uri: &str,
) -> AppResult<AuthTokens> {
    // Build the form body before the async call so the Serializer (non-Send)
    // doesn't live across an .await point.
    let form_body = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("grant_type", "authorization_code")
        .append_pair("client_id", CLIENT_ID)
        .append_pair("code_verifier", code_verifier)
        .append_pair("code", code)
        .append_pair("redirect_uri", redirect_uri)
        .finish();

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("https://{AUTH0_DOMAIN}/oauth/token"))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(form_body)
        .send()
        .await
        .map_err(|e| AppError::Http(format!("token exchange request failed: {e}")))?;

    if !resp.status().is_success() {
        let body = resp
            .text()
            .await
            .unwrap_or_else(|_| "unknown error".to_string());
        return Err(AppError::Http(format!("token exchange failed: {body}")));
    }

    let tr: TokenResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Http(format!("failed to parse token response: {e}")))?;

    // Compute expiration timestamp (prefer JWT `exp` claim)
    let token_for_exp = tr.id_token.as_deref().unwrap_or(&tr.access_token);
    let expires_at = parse_jwt_exp(token_for_exp)
        .map(|exp| exp * 1000) // seconds → milliseconds
        .unwrap_or_else(|| {
            let now_ms = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64;
            now_ms + tr.expires_in * 1000
        });

    Ok(AuthTokens {
        access_token: tr.access_token,
        refresh_token: tr.refresh_token,
        id_token: tr.id_token,
        expires_in: tr.expires_in,
        expires_at,
    })
}

/// Fetches the user profile from Auth0's `/userinfo` endpoint.
pub async fn fetch_user_info(access_token: &str) -> AppResult<User> {
    let client = reqwest::Client::new();
    let resp = client
        .get(format!("https://{AUTH0_DOMAIN}/userinfo"))
        .header("Authorization", format!("Bearer {access_token}"))
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|e| AppError::Http(format!("userinfo request failed: {e}")))?;

    if !resp.status().is_success() {
        return Err(AppError::Http(format!(
            "failed to fetch user info: {}",
            resp.status()
        )));
    }

    let info: UserInfoResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Http(format!("failed to parse userinfo: {e}")))?;

    Ok(User {
        sub: info.sub,
        name: info.name,
        email: info.email,
        picture: info.picture,
        updated_at: info.updated_at,
    })
}

/// Revokes an access token at Auth0's `/oauth/revoke` endpoint.
pub async fn revoke_token(access_token: &str) -> AppResult<()> {
    let form_body = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("client_id", CLIENT_ID)
        .append_pair("token", access_token)
        .finish();

    let client = reqwest::Client::new();
    let _ = client
        .post(format!("https://{AUTH0_DOMAIN}/oauth/revoke"))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(form_body)
        .send()
        .await;
    Ok(())
}

/// Returns the current timestamp in milliseconds.
pub fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

/// Checks whether the stored tokens are still valid (not expired).
pub fn is_token_valid(tokens: &AuthTokens) -> bool {
    now_millis() < tokens.expires_at
}
