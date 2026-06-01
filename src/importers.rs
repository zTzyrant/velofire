use crate::models::{
    ApiKeyLocation, ApiRequest, Auth, Collection, CollectionFolder, FormField, FormFieldType,
    Header, HttpMethod, RequestBody, SavedRequest,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ImportError {
    #[error("parse error: {0}")]
    Parse(String),
    #[error("unsupported import format: {0}")]
    Unsupported(String),
}

pub type ImportResult<T> = Result<T, ImportError>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportReport {
    pub collection: Collection,
    pub warnings: Vec<String>,
    pub unsupported: Vec<String>,
    pub source_format: String,
    pub source_version: Option<String>,
    pub imported_request_count: usize,
}

pub fn import_curl(command: &str) -> ImportResult<ApiRequest> {
    let tokens = tokenize_shell(command)?;
    let mut iter = tokens.into_iter().peekable();
    let first = iter
        .next()
        .ok_or_else(|| ImportError::Parse("empty cURL command".to_string()))?;
    if first != "curl" {
        return Err(ImportError::Parse(
            "command must start with curl".to_string(),
        ));
    }

    let mut request = ApiRequest::default();
    request.name = Some("Imported cURL Request".to_string());
    let mut body: Option<String> = None;

    while let Some(token) = iter.next() {
        match token.as_str() {
            "-X" | "--request" => {
                let method = iter
                    .next()
                    .ok_or_else(|| ImportError::Parse("missing method after -X".to_string()))?;
                request.method = parse_method(&method)?;
            }
            "-H" | "--header" => {
                let header = iter
                    .next()
                    .ok_or_else(|| ImportError::Parse("missing header value".to_string()))?;
                let (key, value) = split_header(&header)?;
                request.headers.push(Header {
                    key,
                    value,
                    enabled: true,
                });
            }
            "-d" | "--data" | "--data-raw" | "--data-binary" | "--data-ascii" => {
                body = Some(
                    iter.next()
                        .ok_or_else(|| ImportError::Parse("missing data value".to_string()))?,
                );
                if request.method == HttpMethod::Get {
                    request.method = HttpMethod::Post;
                }
            }
            "-u" | "--user" => {
                let value = iter
                    .next()
                    .ok_or_else(|| ImportError::Parse("missing basic auth value".to_string()))?;
                let (username, password) = value.split_once(':').ok_or_else(|| {
                    ImportError::Parse("basic auth must be user:pass".to_string())
                })?;
                request.auth = Auth::Basic {
                    username: username.to_string(),
                    password: password.to_string(),
                };
            }
            token if token.starts_with("http://") || token.starts_with("https://") => {
                request.url = token.to_string();
            }
            token if token.starts_with("-") => {
                if iter.peek().is_some_and(|next| !next.starts_with('-')) {
                    iter.next();
                }
            }
            other if request.url == ApiRequest::default().url => {
                request.url = other.to_string();
            }
            _ => {}
        }
    }

    if let Some(body) = body {
        request.body = if looks_like_json(&body) {
            match serde_json::from_str(&body) {
                Ok(value) => RequestBody::Json { value },
                Err(_) => RequestBody::RawText { value: body },
            }
        } else {
            RequestBody::RawText { value: body }
        };
    }

    Ok(request)
}

pub fn import_postman_collection(content: &str) -> ImportResult<ImportReport> {
    let postman: PostmanCollection =
        serde_json::from_str(content).map_err(|error| ImportError::Parse(error.to_string()))?;
    let collection_id = stable_id("collection", &postman.info.name);
    let version = postman.info.schema.clone();
    let mut ctx = PostmanContext {
        collection_id: collection_id.clone(),
        folders: Vec::new(),
        requests: Vec::new(),
        warnings: Vec::new(),
        unsupported: Vec::new(),
    };

    for item in postman.item {
        import_postman_item(item, None, &mut ctx)?;
    }

    let imported_request_count = ctx.requests.len();
    Ok(ImportReport {
        collection: Collection {
            id: collection_id,
            workspace_id: None,
            name: postman.info.name,
            folders: ctx.folders,
            requests: ctx.requests,
            created_at: None,
            updated_at: None,
            metadata: crate::models::Metadata::new(),
        },
        warnings: ctx.warnings,
        unsupported: ctx.unsupported,
        source_format: "postman".to_string(),
        source_version: version,
        imported_request_count,
    })
}

pub fn import_openapi(content: &str) -> ImportResult<ImportReport> {
    let root: Value = serde_json::from_str(content)
        .or_else(|_| serde_yaml::from_str(content))
        .map_err(|error| ImportError::Parse(error.to_string()))?;

    let title = root
        .pointer("/info/title")
        .and_then(Value::as_str)
        .unwrap_or("Imported OpenAPI")
        .to_string();
    let version = root
        .get("openapi")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let base_url = root
        .get("servers")
        .and_then(Value::as_array)
        .and_then(|servers| servers.first())
        .and_then(|server| server.get("url"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim_end_matches('/')
        .to_string();
    let paths = root
        .get("paths")
        .and_then(Value::as_object)
        .ok_or_else(|| ImportError::Parse("OpenAPI document is missing paths".to_string()))?;

    let collection_id = stable_id("collection", &title);
    let mut folders = Vec::new();
    let mut requests = Vec::new();
    let mut warnings = Vec::new();

    for (path, path_item) in paths {
        let Some(path_item) = path_item.as_object() else {
            warnings.push(format!("path '{path}' is not an object"));
            continue;
        };

        for (method, operation) in path_item {
            let Ok(http_method) = parse_method(method) else {
                continue;
            };
            let operation = operation.as_object();
            let name = operation
                .and_then(|op| op.get("summary"))
                .and_then(Value::as_str)
                .or_else(|| {
                    operation
                        .and_then(|op| op.get("operationId"))
                        .and_then(Value::as_str)
                })
                .unwrap_or(path)
                .to_string();
            let tag = operation
                .and_then(|op| op.get("tags"))
                .and_then(Value::as_array)
                .and_then(|tags| tags.first())
                .and_then(Value::as_str);
            let folder_id = tag.map(|tag| {
                let id = stable_id("folder", tag);
                if !folders
                    .iter()
                    .any(|folder: &CollectionFolder| folder.id == id)
                {
                    folders.push(CollectionFolder {
                        id: id.clone(),
                        name: tag.to_string(),
                        parent_id: None,
                        sort_order: folders.len() as i32,
                        metadata: crate::models::Metadata::new(),
                    });
                }
                id
            });

            let mut request = ApiRequest {
                id: Some(stable_id("request", &format!("{method}:{path}"))),
                name: Some(name.clone()),
                method: http_method,
                url: format!("{base_url}{path}"),
                ..ApiRequest::default()
            };

            if let Some(parameters) = operation
                .and_then(|op| op.get("parameters"))
                .and_then(Value::as_array)
            {
                for parameter in parameters {
                    let name = parameter.get("name").and_then(Value::as_str).unwrap_or("");
                    match parameter.get("in").and_then(Value::as_str) {
                        Some("query") if !name.is_empty() => {
                            request.query_params.push(crate::models::QueryParam {
                                key: name.to_string(),
                                value: format!("{{{{{name}}}}}"),
                                enabled: true,
                            });
                        }
                        Some("header") if !name.is_empty() => request.headers.push(Header {
                            key: name.to_string(),
                            value: format!("{{{{{name}}}}}"),
                            enabled: true,
                        }),
                        _ => {}
                    }
                }
            }

            if operation.and_then(|op| op.get("requestBody")).is_some() {
                request.body = RequestBody::Json {
                    value: serde_json::json!({}),
                };
            }

            requests.push(SavedRequest {
                id: request
                    .id
                    .clone()
                    .unwrap_or_else(|| stable_id("request", &name)),
                collection_id: Some(collection_id.clone()),
                folder_id,
                name,
                request,
                created_at: None,
                updated_at: None,
            });
        }
    }

    let imported_request_count = requests.len();
    Ok(ImportReport {
        collection: Collection {
            id: collection_id,
            workspace_id: None,
            name: title,
            folders,
            requests,
            created_at: None,
            updated_at: None,
            metadata: crate::models::Metadata::new(),
        },
        warnings,
        unsupported: Vec::new(),
        source_format: "openapi".to_string(),
        source_version: version,
        imported_request_count,
    })
}

fn import_postman_item(
    item: PostmanItem,
    parent_id: Option<String>,
    ctx: &mut PostmanContext,
) -> ImportResult<()> {
    if let Some(children) = item.item {
        let folder_id = stable_id("folder", &format!("{}:{parent_id:?}", item.name));
        ctx.folders.push(CollectionFolder {
            id: folder_id.clone(),
            name: item.name,
            parent_id,
            sort_order: ctx.folders.len() as i32,
            metadata: crate::models::Metadata::new(),
        });
        for child in children {
            import_postman_item(child, Some(folder_id.clone()), ctx)?;
        }
        return Ok(());
    }

    let Some(request) = item.request else {
        ctx.warnings
            .push(format!("item '{}' has no request", item.name));
        return Ok(());
    };

    let mut api_request = ApiRequest {
        id: Some(stable_id(
            "request",
            &format!("{}:{}", item.name, ctx.requests.len()),
        )),
        name: Some(item.name.clone()),
        method: parse_method(&request.method.unwrap_or_else(|| "GET".to_string()))?,
        url: postman_url_to_string(request.url)?,
        headers: request
            .header
            .unwrap_or_default()
            .into_iter()
            .filter(|header| !header.disabled.unwrap_or(false))
            .map(|header| Header {
                key: header.key,
                value: header.value.unwrap_or_default(),
                enabled: true,
            })
            .collect(),
        ..ApiRequest::default()
    };

    if let Some(body) = request.body {
        api_request.body = postman_body_to_request_body(body, ctx);
    }
    if let Some(auth) = request.auth {
        api_request.auth = postman_auth_to_auth(auth, ctx);
    }

    ctx.requests.push(SavedRequest {
        id: api_request
            .id
            .clone()
            .unwrap_or_else(|| stable_id("request", &item.name)),
        collection_id: Some(ctx.collection_id.clone()),
        folder_id: parent_id,
        name: item.name,
        request: api_request,
        created_at: None,
        updated_at: None,
    });

    Ok(())
}

fn postman_body_to_request_body(body: PostmanBody, ctx: &mut PostmanContext) -> RequestBody {
    match body.mode.as_deref() {
        Some("raw") => {
            let raw = body.raw.unwrap_or_default();
            if looks_like_json(&raw) {
                serde_json::from_str(&raw)
                    .map(|value| RequestBody::Json { value })
                    .unwrap_or(RequestBody::RawText { value: raw })
            } else {
                RequestBody::RawText { value: raw }
            }
        }
        Some("urlencoded") => RequestBody::UrlEncoded {
            fields: body
                .urlencoded
                .unwrap_or_default()
                .into_iter()
                .map(|field| FormField {
                    key: field.key,
                    field_type: FormFieldType::Text,
                    value: field.value.unwrap_or_default(),
                    file_path: None,
                    file_name: None,
                    content_type: None,
                    enabled: !field.disabled.unwrap_or(false),
                })
                .collect(),
        },
        Some("formdata") => RequestBody::FormData {
            fields: body
                .formdata
                .unwrap_or_default()
                .into_iter()
                .map(|field| {
                    let field_type = field
                        .extra
                        .get("type")
                        .and_then(Value::as_str)
                        .filter(|value| *value == "file")
                        .map(|_| FormFieldType::File)
                        .unwrap_or(FormFieldType::Text);
                    let value = field.value.unwrap_or_default();
                    FormField {
                        key: field.key,
                        field_type: field_type.clone(),
                        value: if field_type == FormFieldType::Text {
                            value.clone()
                        } else {
                            String::new()
                        },
                        file_path: (field_type == FormFieldType::File && !value.is_empty())
                            .then_some(value),
                        file_name: None,
                        content_type: field
                            .extra
                            .get("contentType")
                            .and_then(Value::as_str)
                            .map(ToOwned::to_owned),
                        enabled: !field.disabled.unwrap_or(false),
                    }
                })
                .collect(),
        },
        Some(mode) => {
            ctx.unsupported.push(format!("postman body mode '{mode}'"));
            RequestBody::None
        }
        None => RequestBody::None,
    }
}

fn postman_auth_to_auth(auth: PostmanAuth, ctx: &mut PostmanContext) -> Auth {
    match auth.auth_type.as_deref() {
        Some("bearer") => Auth::Bearer {
            token: auth
                .bearer
                .unwrap_or_default()
                .into_iter()
                .find(|entry| entry.key == "token")
                .and_then(|entry| entry.value)
                .unwrap_or_default(),
        },
        Some("basic") => {
            let mut username = String::new();
            let mut password = String::new();
            for entry in auth.basic.unwrap_or_default() {
                match entry.key.as_str() {
                    "username" => username = entry.value.unwrap_or_default(),
                    "password" => password = entry.value.unwrap_or_default(),
                    _ => {}
                }
            }
            Auth::Basic { username, password }
        }
        Some("apikey") => {
            let mut key = "x-api-key".to_string();
            let mut value = String::new();
            let mut location = ApiKeyLocation::Header;
            for entry in auth.apikey.unwrap_or_default() {
                match entry.key.as_str() {
                    "key" => key = entry.value.unwrap_or(key),
                    "value" => value = entry.value.unwrap_or_default(),
                    "in" if entry.value.as_deref() == Some("query") => {
                        location = ApiKeyLocation::Query
                    }
                    _ => {}
                }
            }
            Auth::ApiKey {
                key,
                value,
                location,
            }
        }
        Some(kind) => {
            ctx.unsupported.push(format!("postman auth '{kind}'"));
            Auth::None
        }
        None => Auth::None,
    }
}

fn postman_url_to_string(url: Option<PostmanUrl>) -> ImportResult<String> {
    match url {
        Some(PostmanUrl::String(value)) => Ok(value),
        Some(PostmanUrl::Object {
            raw,
            protocol,
            host,
            path,
        }) => {
            if let Some(raw) = raw {
                return Ok(raw);
            }
            let protocol = protocol.unwrap_or_else(|| "https".to_string());
            let host = host.unwrap_or_default().join(".");
            let path = path.unwrap_or_default().join("/");
            Ok(format!("{protocol}://{host}/{path}"))
        }
        None => Err(ImportError::Parse(
            "postman request is missing url".to_string(),
        )),
    }
}

fn parse_method(method: &str) -> ImportResult<HttpMethod> {
    match method.to_ascii_uppercase().as_str() {
        "GET" => Ok(HttpMethod::Get),
        "POST" => Ok(HttpMethod::Post),
        "PUT" => Ok(HttpMethod::Put),
        "PATCH" => Ok(HttpMethod::Patch),
        "DELETE" => Ok(HttpMethod::Delete),
        other => Err(ImportError::Unsupported(format!("HTTP method {other}"))),
    }
}

fn split_header(value: &str) -> ImportResult<(String, String)> {
    value
        .split_once(':')
        .map(|(key, value)| (key.trim().to_string(), value.trim().to_string()))
        .ok_or_else(|| ImportError::Parse(format!("invalid header '{value}'")))
}

fn looks_like_json(value: &str) -> bool {
    let trimmed = value.trim();
    (trimmed.starts_with('{') && trimmed.ends_with('}'))
        || (trimmed.starts_with('[') && trimmed.ends_with(']'))
}

fn tokenize_shell(command: &str) -> ImportResult<Vec<String>> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;
    let mut escaped = false;

    for char in command.chars() {
        if escaped {
            current.push(char);
            escaped = false;
            continue;
        }
        if char == '\\' {
            escaped = true;
            continue;
        }
        if let Some(active_quote) = quote {
            if char == active_quote {
                quote = None;
            } else {
                current.push(char);
            }
            continue;
        }
        match char {
            '\'' | '"' => quote = Some(char),
            char if char.is_whitespace() => {
                if !current.is_empty() {
                    tokens.push(std::mem::take(&mut current));
                }
            }
            _ => current.push(char),
        }
    }

    if quote.is_some() {
        return Err(ImportError::Parse("unterminated quote".to_string()));
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    Ok(tokens)
}

struct PostmanContext {
    collection_id: String,
    folders: Vec<CollectionFolder>,
    requests: Vec<SavedRequest>,
    warnings: Vec<String>,
    unsupported: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct PostmanCollection {
    info: PostmanInfo,
    item: Vec<PostmanItem>,
}

#[derive(Debug, Deserialize)]
struct PostmanInfo {
    name: String,
    #[serde(rename = "schema")]
    schema: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PostmanItem {
    name: String,
    item: Option<Vec<PostmanItem>>,
    request: Option<PostmanRequest>,
}

#[derive(Debug, Deserialize)]
struct PostmanRequest {
    method: Option<String>,
    url: Option<PostmanUrl>,
    header: Option<Vec<PostmanHeader>>,
    body: Option<PostmanBody>,
    auth: Option<PostmanAuth>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum PostmanUrl {
    String(String),
    Object {
        raw: Option<String>,
        protocol: Option<String>,
        host: Option<Vec<String>>,
        path: Option<Vec<String>>,
    },
}

#[derive(Debug, Deserialize)]
struct PostmanHeader {
    key: String,
    value: Option<String>,
    disabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct PostmanBody {
    mode: Option<String>,
    raw: Option<String>,
    urlencoded: Option<Vec<PostmanKeyValue>>,
    formdata: Option<Vec<PostmanKeyValue>>,
}

#[derive(Debug, Deserialize)]
struct PostmanAuth {
    #[serde(rename = "type")]
    auth_type: Option<String>,
    bearer: Option<Vec<PostmanKeyValue>>,
    basic: Option<Vec<PostmanKeyValue>>,
    apikey: Option<Vec<PostmanKeyValue>>,
}

#[derive(Debug, Deserialize)]
struct PostmanKeyValue {
    key: String,
    value: Option<String>,
    disabled: Option<bool>,
    #[allow(dead_code)]
    #[serde(flatten)]
    extra: std::collections::BTreeMap<String, Value>,
}

fn stable_id(prefix: &str, value: &str) -> String {
    let hash = value.bytes().fold(0xcbf29ce484222325u64, |hash, byte| {
        let hash = hash ^ u64::from(byte);
        hash.wrapping_mul(0x100000001b3)
    });
    format!("{prefix}-{hash:016x}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn imports_curl_get_with_header() {
        let request =
            import_curl("curl -H 'Accept: application/json' https://example.com").unwrap();

        assert_eq!(request.method, HttpMethod::Get);
        assert_eq!(request.url, "https://example.com");
        assert_eq!(request.headers[0].key, "Accept");
    }

    #[test]
    fn imports_curl_post_json() {
        let request = import_curl("curl -X POST https://example.com -d '{\"ok\":true}'").unwrap();

        assert_eq!(request.method, HttpMethod::Post);
        assert!(matches!(request.body, RequestBody::Json { .. }));
    }

    #[test]
    fn imports_postman_collection() {
        let json = r#"{
          "info": {"name": "Demo", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
          "item": [{
            "name": "Users",
            "item": [{
              "name": "List users",
              "request": {
                "method": "GET",
                "url": "https://example.com/users",
                "header": [{"key": "Accept", "value": "application/json"}]
              }
            }]
          }]
        }"#;

        let report = import_postman_collection(json).unwrap();

        assert_eq!(report.collection.name, "Demo");
        assert_eq!(report.collection.folders.len(), 1);
        assert_eq!(report.imported_request_count, 1);
    }

    #[test]
    fn imports_openapi_paths() {
        let yaml = r#"
openapi: 3.0.0
info:
  title: Demo API
servers:
  - url: https://example.com
paths:
  /users:
    get:
      tags: [Users]
      summary: List users
      parameters:
        - name: limit
          in: query
"#;

        let report = import_openapi(yaml).unwrap();

        assert_eq!(report.collection.name, "Demo API");
        assert_eq!(report.imported_request_count, 1);
        assert_eq!(
            report.collection.requests[0].request.url,
            "https://example.com/users"
        );
    }
}
