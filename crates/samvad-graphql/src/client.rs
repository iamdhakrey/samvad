use samvad_error::{AppError, AppResult};
use samvad_models::GraphQlResponse;
use std::collections::BTreeMap;
use std::time::Instant;

use crate::introspection::build_client;

/// Execute a GraphQL query or mutation over HTTP POST.
///
/// Handles building the JSON request body, forwarding custom headers,
/// measuring round-trip latency, and extracting `data`/`errors`/`extensions`
/// from the response — all in Rust.
pub async fn execute_graphql(
    url: &str,
    query: &str,
    variables: Option<serde_json::Value>,
    operation_name: Option<&str>,
    headers: BTreeMap<String, String>,
    validate_certs: bool,
    timeout_ms: u64,
) -> AppResult<GraphQlResponse> {
    let client = build_client(validate_certs, timeout_ms)?;

    // Build the GraphQL request body per the spec.
    let mut body = serde_json::json!({ "query": query });
    if let Some(vars) = variables {
        body["variables"] = vars;
    }

    let resolved_operation_name = if let Some(op) = operation_name {
        if !op.trim().is_empty() {
            Some(op.trim().to_string())
        } else {
            None
        }
    } else {
        None
    };

    // If no operationName was explicitly supplied, auto-detect from the query document
    let op_to_send = resolved_operation_name.or_else(|| {
        let ops = extract_operation_names(query);
        ops.first().map(|(_, name)| name.clone())
    });

    if let Some(op) = op_to_send {
        body["operationName"] = serde_json::Value::String(op);
    }

    let start = Instant::now();

    let mut builder = client
        .post(url)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&body);

    for (k, v) in &headers {
        builder = builder.header(k, v);
    }

    let resp = builder
        .send()
        .await
        .map_err(|e| AppError::GraphQlError(format!("GraphQL request failed: {e}")))?;

    let time_ms = start.elapsed().as_millis();
    let status = resp.status().as_u16();
    let status_text = resp
        .status()
        .canonical_reason()
        .unwrap_or("Unknown")
        .to_string();

    // Collect response headers into a BTreeMap for the frontend.
    let mut resp_headers = BTreeMap::new();
    for (k, v) in resp.headers() {
        if let Ok(val) = v.to_str() {
            resp_headers.insert(k.to_string(), val.to_string());
        }
    }

    let body_bytes = resp
        .bytes()
        .await
        .map_err(|e| AppError::GraphQlError(format!("Failed to read response body: {e}")))?;
    let size_bytes = body_bytes.len() as u64;
    let body_str = String::from_utf8_lossy(&body_bytes);

    // Parse the JSON to extract data / errors / extensions separately.
    let json: serde_json::Value = serde_json::from_str(&body_str)
        .map_err(|e| AppError::GraphQlError(format!("Response is not valid JSON: {e}")))?;

    let data = json
        .get("data")
        .filter(|v| !v.is_null())
        .map(|v| serde_json::to_string_pretty(v).unwrap_or_default());

    let errors = json
        .get("errors")
        .filter(|v| !v.is_null())
        .map(|v| serde_json::to_string_pretty(v).unwrap_or_default());

    let extensions = json
        .get("extensions")
        .filter(|v| !v.is_null())
        .map(|v| serde_json::to_string_pretty(v).unwrap_or_default());

    Ok(GraphQlResponse {
        status,
        status_text,
        time_ms,
        size_bytes,
        headers: resp_headers,
        data,
        errors,
        extensions,
    })
}

/// Extract named operations from a GraphQL query string.
/// Returns a list of `(keyword, operation_name)`.
pub fn extract_operation_names(query: &str) -> Vec<(String, String)> {
    let mut operations = Vec::new();
    for line in query.lines() {
        let trimmed = line.trim();
        // Skip comments
        if trimmed.starts_with('#') {
            continue;
        }
        for keyword in &["query", "mutation", "subscription"] {
            if let Some(rest) = trimmed.strip_prefix(keyword) {
                let rest_trimmed = rest.trim_start();
                // If the next character is '{' or '(', it's an anonymous operation
                if !rest_trimmed.starts_with('{')
                    && !rest_trimmed.starts_with('(')
                    && !rest_trimmed.is_empty()
                {
                    let op_name: String = rest_trimmed
                        .chars()
                        .take_while(|c| c.is_alphanumeric() || *c == '_')
                        .collect();
                    if !op_name.is_empty() {
                        operations.push((keyword.to_string(), op_name));
                    }
                }
            }
        }
    }
    operations
}
