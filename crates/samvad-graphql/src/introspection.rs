use samvad_error::{AppError, AppResult};
use samvad_models::{GraphQlArg, GraphQlField, GraphQlSchema, GraphQlSchemaType, GraphQlTypeRef};
use std::collections::BTreeMap;

/// The standard GraphQL introspection query (full schema).
const INTROSPECTION_QUERY: &str = r#"
query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      ...FullType
    }
  }
}
fragment FullType on __Type {
  kind
  name
  description
  fields(includeDeprecated: true) {
    name
    description
    args {
      ...InputValue
    }
    type {
      ...TypeRef
    }
    isDeprecated
    deprecationReason
  }
  inputFields {
    ...InputValue
  }
  enumValues(includeDeprecated: true) {
    name
    description
    isDeprecated
    deprecationReason
  }
}
fragment InputValue on __InputValue {
  name
  description
  type { ...TypeRef }
  defaultValue
}
fragment TypeRef on __Type {
  kind
  name
  ofType {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
          }
        }
      }
    }
  }
}
"#;

/// Build a `reqwest::Client` with optional certificate validation.
pub fn build_client(validate_certs: bool, timeout_ms: u64) -> AppResult<reqwest::Client> {
    reqwest::Client::builder()
        .danger_accept_invalid_certs(!validate_certs)
        .timeout(std::time::Duration::from_millis(timeout_ms))
        .build()
        .map_err(|e| AppError::GraphQlError(format!("Failed to build HTTP client: {e}")))
}

/// Execute the GraphQL introspection query against the given endpoint
/// and return a fully parsed `GraphQlSchema`.
pub async fn fetch_schema(
    url: &str,
    headers: BTreeMap<String, String>,
    validate_certs: bool,
) -> AppResult<GraphQlSchema> {
    let client = build_client(validate_certs, 30_000)?;

    let body = serde_json::json!({
        "query": INTROSPECTION_QUERY,
        "operationName": "IntrospectionQuery",
    });

    let mut request = client.post(url).json(&body);
    for (k, v) in &headers {
        request = request.header(k, v);
    }

    let response = request
        .send()
        .await
        .map_err(|e| AppError::GraphQlError(format!("Introspection request failed: {e}")))?;

    let status = response.status().as_u16();
    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(AppError::GraphQlError(format!(
            "Introspection returned HTTP {status}: {text}"
        )));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| AppError::GraphQlError(format!("Failed to parse introspection JSON: {e}")))?;

    if let Some(errors) = json.get("errors") {
        let msg = serde_json::to_string_pretty(errors).unwrap_or_default();
        return Err(AppError::GraphQlError(format!(
            "GraphQL errors during introspection: {msg}"
        )));
    }

    parse_introspection(json)
}

/// Parse a raw introspection JSON response into a [`GraphQlSchema`].
pub fn parse_introspection(json: serde_json::Value) -> AppResult<GraphQlSchema> {
    let schema_json = json.pointer("/data/__schema").ok_or_else(|| {
        AppError::GraphQlError("Missing /data/__schema in introspection response".into())
    })?;

    let query_type = schema_json
        .pointer("/queryType/name")
        .and_then(|v| v.as_str())
        .map(str::to_string);

    let mutation_type = schema_json
        .pointer("/mutationType/name")
        .and_then(|v| v.as_str())
        .map(str::to_string);

    let subscription_type = schema_json
        .pointer("/subscriptionType/name")
        .and_then(|v| v.as_str())
        .map(str::to_string);

    let raw_types = schema_json
        .get("types")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut types: Vec<GraphQlSchemaType> = Vec::with_capacity(raw_types.len());

    for t in raw_types {
        let name = match t.get("name").and_then(|v| v.as_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        // Skip built-in introspection types
        if name.starts_with("__") {
            continue;
        }

        let kind = t
            .get("kind")
            .and_then(|v| v.as_str())
            .unwrap_or("OBJECT")
            .to_string();

        let description = t
            .get("description")
            .and_then(|v| v.as_str())
            .map(str::to_string);

        // Parse fields
        let fields = t
            .get("fields")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|f| parse_field(f))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        // Parse inputFields (for INPUT_OBJECT)
        let input_fields = t
            .get("inputFields")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|f| parse_arg(f)).collect::<Vec<_>>())
            .unwrap_or_default();

        // Parse enum values
        let enum_values = t
            .get("enumValues")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|ev| {
                        let name = ev.get("name")?.as_str()?.to_string();
                        let desc = ev
                            .get("description")
                            .and_then(|d| d.as_str())
                            .map(str::to_string);
                        let deprecated = ev
                            .get("isDeprecated")
                            .and_then(|d| d.as_bool())
                            .unwrap_or(false);
                        let dep_reason = ev
                            .get("deprecationReason")
                            .and_then(|d| d.as_str())
                            .map(str::to_string);
                        Some(samvad_models::GraphQlEnumValue {
                            name,
                            description: desc,
                            is_deprecated: deprecated,
                            deprecation_reason: dep_reason,
                        })
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        types.push(GraphQlSchemaType {
            name,
            kind,
            description,
            fields,
            input_fields,
            enum_values,
        });
    }

    Ok(GraphQlSchema {
        query_type,
        mutation_type,
        subscription_type,
        types,
    })
}

fn parse_type_ref(v: &serde_json::Value) -> GraphQlTypeRef {
    let kind = v
        .get("kind")
        .and_then(|k| k.as_str())
        .unwrap_or("SCALAR")
        .to_string();
    let name = v.get("name").and_then(|n| n.as_str()).map(str::to_string);
    let of_type = v
        .get("ofType")
        .filter(|ot| !ot.is_null())
        .map(|ot| Box::new(parse_type_ref(ot)));

    GraphQlTypeRef {
        kind,
        name,
        of_type,
    }
}

fn parse_arg(v: &serde_json::Value) -> Option<GraphQlArg> {
    let name = v.get("name")?.as_str()?.to_string();
    let description = v
        .get("description")
        .and_then(|d| d.as_str())
        .map(str::to_string);
    let type_ref = v.get("type").map(parse_type_ref).unwrap_or(GraphQlTypeRef {
        kind: "SCALAR".to_string(),
        name: Some("String".to_string()),
        of_type: None,
    });
    let default_value = v
        .get("defaultValue")
        .and_then(|d| d.as_str())
        .map(str::to_string);

    Some(GraphQlArg {
        name,
        description,
        type_ref,
        default_value,
    })
}

fn parse_field(v: &serde_json::Value) -> Option<GraphQlField> {
    let name = v.get("name")?.as_str()?.to_string();
    let description = v
        .get("description")
        .and_then(|d| d.as_str())
        .map(str::to_string);
    let type_ref = v.get("type").map(parse_type_ref).unwrap_or(GraphQlTypeRef {
        kind: "SCALAR".to_string(),
        name: Some("String".to_string()),
        of_type: None,
    });
    let is_deprecated = v
        .get("isDeprecated")
        .and_then(|d| d.as_bool())
        .unwrap_or(false);
    let deprecation_reason = v
        .get("deprecationReason")
        .and_then(|d| d.as_str())
        .map(str::to_string);
    let args = v
        .get("args")
        .and_then(|a| a.as_array())
        .map(|arr| arr.iter().filter_map(|a| parse_arg(a)).collect::<Vec<_>>())
        .unwrap_or_default();

    Some(GraphQlField {
        name,
        description,
        type_ref,
        args,
        is_deprecated,
        deprecation_reason,
    })
}
