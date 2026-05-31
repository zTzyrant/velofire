use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

pub type Metadata = BTreeMap<String, String>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub root_path: String,
    #[serde(default)]
    pub active_environment_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Collection {
    pub id: String,
    #[serde(default)]
    pub workspace_id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub folders: Vec<CollectionFolder>,
    #[serde(default)]
    pub requests: Vec<SavedRequest>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

impl Collection {
    pub fn new(name: impl Into<String>) -> Self {
        let name = name.into();
        Self {
            id: stable_id("collection", &name),
            workspace_id: None,
            name,
            folders: Vec::new(),
            requests: Vec::new(),
            created_at: None,
            updated_at: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CollectionFolder {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub sort_order: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SavedRequest {
    pub id: String,
    #[serde(default)]
    pub collection_id: Option<String>,
    #[serde(default)]
    pub folder_id: Option<String>,
    pub name: String,
    pub request: ApiRequest,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ApiRequest {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub path: Vec<String>,
    pub method: HttpMethod,
    pub url: String,
    #[serde(default)]
    pub query_params: Vec<QueryParam>,
    #[serde(default)]
    pub headers: Vec<Header>,
    #[serde(default)]
    pub body: RequestBody,
    #[serde(default)]
    pub auth: Auth,
    #[serde(default)]
    pub scripts: RequestScripts,
    #[serde(default = "default_timeout_ms")]
    pub timeout_ms: u64,
    #[serde(default)]
    pub metadata: Metadata,
}

impl Default for ApiRequest {
    fn default() -> Self {
        Self {
            id: None,
            name: None,
            path: Vec::new(),
            method: HttpMethod::Get,
            url: String::new(),
            query_params: Vec::new(),
            headers: Vec::new(),
            body: RequestBody::None,
            auth: Auth::None,
            scripts: RequestScripts::default(),
            timeout_ms: default_timeout_ms(),
            metadata: Metadata::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct RequestScripts {
    #[serde(default)]
    pub pre_request: String,
    #[serde(default)]
    pub post_request: String,
}

impl ApiRequest {
    pub fn new(name: impl Into<String>, method: HttpMethod, url: impl Into<String>) -> Self {
        Self {
            name: Some(name.into()),
            method,
            url: url.into(),
            ..Self::default()
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct QueryParam {
    pub key: String,
    pub value: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Header {
    pub key: String,
    pub value: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

impl Header {
    pub fn enabled(key: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            key: key.into(),
            value: value.into(),
            enabled: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Head,
    Options,
    Other(String),
}

impl HttpMethod {
    pub fn parse(method: &str) -> Self {
        match method.trim().to_ascii_uppercase().as_str() {
            "GET" => Self::Get,
            "POST" => Self::Post,
            "PUT" => Self::Put,
            "PATCH" => Self::Patch,
            "DELETE" => Self::Delete,
            "HEAD" => Self::Head,
            "OPTIONS" => Self::Options,
            other => Self::Other(other.to_string()),
        }
    }

    pub fn as_reqwest_method(&self) -> reqwest::Method {
        match self {
            Self::Get => reqwest::Method::GET,
            Self::Post => reqwest::Method::POST,
            Self::Put => reqwest::Method::PUT,
            Self::Patch => reqwest::Method::PATCH,
            Self::Delete => reqwest::Method::DELETE,
            Self::Head => reqwest::Method::HEAD,
            Self::Options => reqwest::Method::OPTIONS,
            Self::Other(method) => {
                reqwest::Method::from_bytes(method.as_bytes()).unwrap_or(reqwest::Method::GET)
            }
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RequestBody {
    #[default]
    None,
    Json {
        value: serde_json::Value,
    },
    FormData {
        fields: Vec<FormField>,
    },
    UrlEncoded {
        fields: Vec<FormField>,
    },
    RawText {
        value: String,
    },
    Xml {
        value: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FormField {
    pub key: String,
    pub value: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Auth {
    #[default]
    None,
    Bearer {
        token: String,
    },
    Basic {
        username: String,
        password: String,
    },
    ApiKey {
        key: String,
        value: String,
        location: ApiKeyLocation,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApiKeyLocation {
    Header,
    Query,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Environment {
    pub id: String,
    #[serde(default)]
    pub workspace_id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub variables: Vec<EnvironmentVariable>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EnvironmentVariable {
    pub key: String,
    pub value: String,
    #[serde(default)]
    pub is_secret: bool,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ApiResponse {
    pub status: u16,
    pub status_text: String,
    #[serde(default)]
    pub headers: Vec<Header>,
    #[serde(default)]
    pub body: Vec<u8>,
    pub body_text: String,
    pub body_bytes_len: usize,
    #[serde(default)]
    pub body_truncated: bool,
    #[serde(default)]
    pub content_type: Option<String>,
    pub duration_ms: u128,
    pub started_at_ms: u128,
    pub finished_at_ms: u128,
    #[serde(default)]
    pub final_url: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RequestHistoryEntry {
    pub id: String,
    #[serde(default)]
    pub workspace_id: Option<String>,
    pub request_snapshot: ApiRequest,
    #[serde(default)]
    pub response_snapshot: Option<ApiResponse>,
    pub created_at: String,
}

fn default_true() -> bool {
    true
}

fn default_timeout_ms() -> u64 {
    30_000
}

pub fn stable_id(prefix: &str, value: &str) -> String {
    let hash = value.bytes().fold(0xcbf29ce484222325u64, |hash, byte| {
        let hash = hash ^ u64::from(byte);
        hash.wrapping_mul(0x100000001b3)
    });
    format!("{prefix}-{hash:016x}")
}
