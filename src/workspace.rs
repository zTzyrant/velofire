use crate::http_engine::mask_sensitive_headers;
use crate::models::{
    ApiRequest, ApiResponse, Auth, Collection, Environment, EnvironmentVariable, FormField,
    FormFieldType, Header, RequestBody, RequestHistoryEntry, SavedRequest, Workspace,
};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

const MAX_HISTORY_RESPONSE_BODY_BYTES: usize = 256 * 1024;

#[derive(Debug, Error)]
pub enum WorkspaceError {
    #[error("storage error: {0}")]
    Storage(#[from] std::io::Error),
    #[error("serialization error: {0}")]
    Serialization(String),
    #[error("environment variable not found: {0}")]
    MissingVariable(String),
    #[error("invalid workspace path")]
    InvalidPath,
}

pub type WorkspaceResult<T> = Result<T, WorkspaceError>;

pub struct FileWorkspaceStore {
    root: PathBuf,
}

impl FileWorkspaceStore {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn init(&self, name: impl Into<String>) -> WorkspaceResult<Workspace> {
        fs::create_dir_all(self.collections_dir())?;
        fs::create_dir_all(self.environments_dir())?;

        let now = timestamp();
        let workspace = Workspace {
            id: stable_id("workspace", self.root.to_string_lossy().as_ref()),
            name: name.into(),
            root_path: self.root.to_string_lossy().into_owned(),
            active_environment_id: None,
            created_at: now.clone(),
            updated_at: now,
        };
        self.write_yaml(".velofire-workspace.yaml", &workspace)?;
        Ok(workspace)
    }

    pub fn load_workspace(&self) -> WorkspaceResult<Workspace> {
        self.read_yaml(".velofire-workspace.yaml")
    }

    pub fn save_collection(&self, collection: &Collection) -> WorkspaceResult<PathBuf> {
        let collection_dir = self.collections_dir().join(slug(&collection.name));
        let requests_dir = collection_dir.join("requests");
        fs::create_dir_all(&requests_dir)?;

        let sanitized = sanitize_collection_secrets(collection);
        let mut manifest = sanitized.clone();
        manifest.requests.clear();
        let manifest_path = collection_dir.join("collection.yaml");
        self.write_yaml_at(&manifest_path, &manifest)?;

        for saved in &sanitized.requests {
            let request_path = request_file_path(&requests_dir, saved);
            if let Some(parent) = request_path.parent() {
                fs::create_dir_all(parent)?;
            }
            self.write_yaml_at(&request_path, saved)?;
        }

        Ok(collection_dir)
    }

    pub fn load_collections(&self) -> WorkspaceResult<Vec<Collection>> {
        let dir = self.collections_dir();
        if !dir.exists() {
            return Ok(Vec::new());
        }

        let mut collections = Vec::new();
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            let manifest_path = path.join("collection.yaml");
            if manifest_path.exists() {
                let mut collection: Collection = self.read_yaml_at(&manifest_path)?;
                let requests_dir = path.join("requests");
                if requests_dir.exists() {
                    read_saved_requests(&requests_dir, &mut collection.requests)?;
                }
                collection
                    .requests
                    .sort_by(|a, b| a.folder_id.cmp(&b.folder_id).then(a.name.cmp(&b.name)));
                collections.push(collection);
            }
        }
        collections.sort_by(|a: &Collection, b: &Collection| a.name.cmp(&b.name));
        Ok(collections)
    }

    pub fn save_environment(&self, environment: &Environment) -> WorkspaceResult<PathBuf> {
        fs::create_dir_all(self.environments_dir())?;
        let filename = format!("{}.yaml", slug(&environment.name));
        let path = self.environments_dir().join(filename);
        self.write_yaml_at(&path, &sanitize_environment_secrets(environment))?;
        Ok(path)
    }

    pub fn load_environments(&self) -> WorkspaceResult<Vec<Environment>> {
        let dir = self.environments_dir();
        if !dir.exists() {
            return Ok(Vec::new());
        }

        let mut environments = Vec::new();
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) == Some("yaml") {
                environments.push(self.read_yaml_at(&path)?);
            }
        }
        environments.sort_by(|a: &Environment, b: &Environment| a.name.cmp(&b.name));
        Ok(environments)
    }

    pub fn append_history(
        &self,
        workspace_id: Option<String>,
        request: &ApiRequest,
        response: Option<&ApiResponse>,
    ) -> WorkspaceResult<RequestHistoryEntry> {
        fs::create_dir_all(self.history_dir())?;
        let now = timestamp();
        let mut request_snapshot = request.clone();
        request_snapshot.headers = mask_sensitive_headers(&request_snapshot.headers);
        request_snapshot.auth = sanitize_auth(&request_snapshot.auth);
        request_snapshot.body = sanitize_body_file_paths(&request_snapshot.body);
        let entry = RequestHistoryEntry {
            id: stable_id("history", &format!("{now}:{}", request.url)),
            workspace_id,
            request_snapshot,
            response_snapshot: response.map(sanitize_history_response),
            created_at: now,
        };
        let line = serde_json::to_string(&entry)
            .map_err(|error| WorkspaceError::Serialization(error.to_string()))?;
        let path = self.history_dir().join("history.jsonl");
        fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)?
            .write_all_with_newline(&line)?;
        Ok(entry)
    }

    pub fn load_history(&self) -> WorkspaceResult<Vec<RequestHistoryEntry>> {
        let path = self.history_path();
        if !path.exists() {
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(path)?;
        let mut entries = Vec::new();
        for line in content.lines().filter(|line| !line.trim().is_empty()) {
            let entry = serde_json::from_str(line)
                .map_err(|error| WorkspaceError::Serialization(error.to_string()))?;
            entries.push(entry);
        }
        entries.reverse();
        Ok(entries)
    }

    pub fn clear_history(&self) -> WorkspaceResult<()> {
        let path = self.history_path();
        if path.exists() {
            fs::write(path, "")?;
        }
        Ok(())
    }

    pub fn export_collection_json(&self, collection: &Collection) -> WorkspaceResult<String> {
        serde_json::to_string_pretty(&sanitize_collection_secrets(collection))
            .map_err(|error| WorkspaceError::Serialization(error.to_string()))
    }

    pub fn export_collection_yaml(&self, collection: &Collection) -> WorkspaceResult<String> {
        serde_yaml::to_string(&sanitize_collection_secrets(collection))
            .map_err(|error| WorkspaceError::Serialization(error.to_string()))
    }

    fn collections_dir(&self) -> PathBuf {
        self.root.join(".collections")
    }

    fn environments_dir(&self) -> PathBuf {
        self.collections_dir().join("environments")
    }

    fn history_dir(&self) -> PathBuf {
        self.collections_dir()
    }

    fn history_path(&self) -> PathBuf {
        self.history_dir().join("history.jsonl")
    }

    fn write_yaml<T: serde::Serialize>(&self, name: &str, value: &T) -> WorkspaceResult<()> {
        self.write_yaml_at(&self.root.join(name), value)
    }

    fn write_yaml_at<T: serde::Serialize>(&self, path: &Path, value: &T) -> WorkspaceResult<()> {
        let serialized = serde_yaml::to_string(value)
            .map_err(|error| WorkspaceError::Serialization(error.to_string()))?;
        fs::write(path, serialized)?;
        Ok(())
    }

    fn read_yaml<T: serde::de::DeserializeOwned>(&self, name: &str) -> WorkspaceResult<T> {
        self.read_yaml_at(&self.root.join(name))
    }

    fn read_yaml_at<T: serde::de::DeserializeOwned>(&self, path: &Path) -> WorkspaceResult<T> {
        let content = fs::read_to_string(path)?;
        serde_yaml::from_str(&content)
            .map_err(|error| WorkspaceError::Serialization(error.to_string()))
    }
}

fn sanitize_history_response(response: &ApiResponse) -> ApiResponse {
    let mut snapshot = response.clone();
    snapshot.headers = mask_sensitive_headers(&snapshot.headers);
    if snapshot.body.len() > MAX_HISTORY_RESPONSE_BODY_BYTES {
        snapshot.body.truncate(MAX_HISTORY_RESPONSE_BODY_BYTES);
        snapshot.body_text = String::from_utf8_lossy(&snapshot.body).into_owned();
        snapshot.body_truncated = true;
    }
    snapshot
}

pub fn sanitize_collection_secrets(collection: &Collection) -> Collection {
    let mut collection = collection.clone();
    for saved in &mut collection.requests {
        saved.request.headers = crate::http_engine::mask_sensitive_headers(&saved.request.headers);
        saved.request.auth = sanitize_auth(&saved.request.auth);
        saved.request.body = sanitize_body_file_paths(&saved.request.body);
    }
    collection
}

pub fn sanitize_environment_secrets(environment: &Environment) -> Environment {
    let mut environment = environment.clone();
    for variable in &mut environment.variables {
        if variable.is_secret || is_sensitive_name(&variable.key) {
            variable.is_secret = true;
            variable.value = "********".to_string();
        }
    }
    environment
}

fn sanitize_auth(auth: &Auth) -> Auth {
    match auth {
        Auth::None => Auth::None,
        Auth::Bearer { .. } => Auth::Bearer {
            token: "********".to_string(),
        },
        Auth::Basic { username, .. } => Auth::Basic {
            username: username.clone(),
            password: "********".to_string(),
        },
        Auth::ApiKey { key, location, .. } => Auth::ApiKey {
            key: key.clone(),
            value: "********".to_string(),
            location: location.clone(),
        },
    }
}

fn sanitize_body_file_paths(body: &RequestBody) -> RequestBody {
    match body {
        RequestBody::FormData { fields } => RequestBody::FormData {
            fields: fields
                .iter()
                .map(|field| {
                    let mut sanitized = field.clone();
                    if sanitized.field_type == FormFieldType::File {
                        sanitized.file_path = sanitized
                            .file_path
                            .as_ref()
                            .map(|_| "<local-file-path-redacted>".to_string());
                    }
                    sanitized
                })
                .collect(),
        },
        other => other.clone(),
    }
}

fn is_sensitive_name(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    ["token", "secret", "password", "key", "credential"]
        .iter()
        .any(|part| name.contains(part))
}

pub fn resolve_request_environment(
    request: &ApiRequest,
    environment: &Environment,
) -> WorkspaceResult<ApiRequest> {
    let variables = variable_map(&environment.variables);
    let mut resolved = request.clone();
    resolved.url = resolve_template(&resolved.url, &variables)?;
    resolved.headers = resolved
        .headers
        .iter()
        .map(|header| {
            Ok(Header {
                key: resolve_template(&header.key, &variables)?,
                value: resolve_template(&header.value, &variables)?,
                enabled: header.enabled,
            })
        })
        .collect::<WorkspaceResult<Vec<_>>>()?;
    resolved.body = match &resolved.body {
        RequestBody::Json { value } => RequestBody::Json {
            value: resolve_json_value(value, &variables)?,
        },
        RequestBody::RawText { value } => RequestBody::RawText {
            value: resolve_template(value, &variables)?,
        },
        RequestBody::Xml { value } => RequestBody::Xml {
            value: resolve_template(value, &variables)?,
        },
        RequestBody::FormData { fields } => RequestBody::FormData {
            fields: resolve_fields(fields, &variables)?,
        },
        RequestBody::UrlEncoded { fields } => RequestBody::UrlEncoded {
            fields: resolve_fields(fields, &variables)?,
        },
        other => other.clone(),
    };
    Ok(resolved)
}

fn request_file_path(root: &Path, saved: &SavedRequest) -> PathBuf {
    let mut path = root.to_path_buf();
    for segment in &saved.request.path {
        path.push(slug(segment));
    }
    path.join(format!("{}.yaml", slug(&saved.name)))
}

fn read_saved_requests(dir: &Path, requests: &mut Vec<SavedRequest>) -> WorkspaceResult<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            read_saved_requests(&path, requests)?;
        } else if path.extension().and_then(|value| value.to_str()) == Some("yaml") {
            let content = fs::read_to_string(&path)?;
            let saved = serde_yaml::from_str(&content)
                .map_err(|error| WorkspaceError::Serialization(error.to_string()))?;
            requests.push(saved);
        }
    }
    Ok(())
}

fn resolve_json_value(
    value: &serde_json::Value,
    variables: &BTreeMap<String, String>,
) -> WorkspaceResult<serde_json::Value> {
    Ok(match value {
        serde_json::Value::String(value) => {
            serde_json::Value::String(resolve_template(value, variables)?)
        }
        serde_json::Value::Array(values) => serde_json::Value::Array(
            values
                .iter()
                .map(|value| resolve_json_value(value, variables))
                .collect::<WorkspaceResult<Vec<_>>>()?,
        ),
        serde_json::Value::Object(map) => {
            let mut resolved = serde_json::Map::new();
            for (key, value) in map {
                resolved.insert(key.clone(), resolve_json_value(value, variables)?);
            }
            serde_json::Value::Object(resolved)
        }
        other => other.clone(),
    })
}

fn resolve_fields(
    fields: &[FormField],
    variables: &BTreeMap<String, String>,
) -> WorkspaceResult<Vec<FormField>> {
    fields
        .iter()
        .filter(|field| field.enabled && !field.key.trim().is_empty())
        .map(|field| {
            Ok(FormField {
                key: resolve_template(&field.key, variables)?,
                field_type: field.field_type.clone(),
                value: resolve_template(&field.value, variables)?,
                file_path: field
                    .file_path
                    .as_ref()
                    .map(|value| resolve_template(value, variables))
                    .transpose()?,
                file_name: field
                    .file_name
                    .as_ref()
                    .map(|value| resolve_template(value, variables))
                    .transpose()?,
                content_type: field
                    .content_type
                    .as_ref()
                    .map(|value| resolve_template(value, variables))
                    .transpose()?,
                enabled: field.enabled,
            })
        })
        .collect()
}

pub fn collection_from_request(name: impl Into<String>, request: ApiRequest) -> Collection {
    let name = name.into();
    let collection_id = stable_id("collection", &name);
    Collection {
        id: collection_id.clone(),
        workspace_id: None,
        name: name.clone(),
        folders: Vec::new(),
        requests: vec![SavedRequest {
            id: stable_id("request", request.url.as_str()),
            collection_id: Some(collection_id),
            folder_id: None,
            name: request.name.clone().unwrap_or(name),
            request,
            created_at: None,
            updated_at: None,
        }],
        created_at: None,
        updated_at: None,
        metadata: crate::models::Metadata::new(),
    }
}

fn variable_map(variables: &[EnvironmentVariable]) -> BTreeMap<String, String> {
    variables
        .iter()
        .filter(|variable| variable.enabled)
        .map(|variable| (variable.key.clone(), variable.value.clone()))
        .collect()
}

pub fn resolve_template(
    value: &str,
    variables: &BTreeMap<String, String>,
) -> WorkspaceResult<String> {
    let mut output = String::with_capacity(value.len());
    let mut rest = value;

    while let Some(start) = rest.find("{{") {
        let (prefix, after_start) = rest.split_at(start);
        output.push_str(prefix);
        let after_start = &after_start[2..];
        let Some(end) = after_start.find("}}") else {
            output.push_str("{{");
            output.push_str(after_start);
            return Ok(output);
        };
        let key = after_start[..end].trim();
        let replacement = variables
            .get(key)
            .ok_or_else(|| WorkspaceError::MissingVariable(key.to_string()))?;
        output.push_str(replacement);
        rest = &after_start[end + 2..];
    }

    output.push_str(rest);
    Ok(output)
}

fn slug(value: &str) -> String {
    let slug = value
        .chars()
        .map(|char| {
            if char.is_ascii_alphanumeric() {
                char.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    if slug.is_empty() {
        "untitled".to_string()
    } else {
        slug
    }
}

fn stable_id(prefix: &str, value: &str) -> String {
    let hash = value.bytes().fold(0xcbf29ce484222325u64, |hash, byte| {
        let hash = hash ^ u64::from(byte);
        hash.wrapping_mul(0x100000001b3)
    });
    format!("{prefix}-{hash:016x}")
}

fn timestamp() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .to_string()
}

trait WriteLine {
    fn write_all_with_newline(&mut self, line: &str) -> std::io::Result<()>;
}

impl WriteLine for std::fs::File {
    fn write_all_with_newline(&mut self, line: &str) -> std::io::Result<()> {
        use std::io::Write;
        self.write_all(line.as_bytes())?;
        self.write_all(b"\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{EnvironmentVariable, HttpMethod};

    fn test_workspace(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("velofire-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        root
    }

    #[test]
    fn resolves_template_variables() {
        let mut vars = BTreeMap::new();
        vars.insert("base_url".to_string(), "https://api.test".to_string());

        assert_eq!(
            resolve_template("{{base_url}}/users", &vars).unwrap(),
            "https://api.test/users"
        );
    }

    #[test]
    fn fails_missing_variable() {
        let vars = BTreeMap::new();

        assert!(matches!(
            resolve_template("{{missing}}", &vars),
            Err(WorkspaceError::MissingVariable(_))
        ));
    }

    #[test]
    fn resolves_request_url_and_headers() {
        let request = ApiRequest {
            method: HttpMethod::Get,
            url: "{{base_url}}/users".to_string(),
            headers: vec![Header {
                key: "Authorization".to_string(),
                value: "Bearer {{token}}".to_string(),
                enabled: true,
            }],
            ..ApiRequest::default()
        };
        let environment = Environment {
            id: "env".to_string(),
            workspace_id: None,
            name: "Local".to_string(),
            variables: vec![
                EnvironmentVariable {
                    key: "base_url".to_string(),
                    value: "https://api.test".to_string(),
                    is_secret: false,
                    enabled: true,
                },
                EnvironmentVariable {
                    key: "token".to_string(),
                    value: "abc".to_string(),
                    is_secret: true,
                    enabled: true,
                },
            ],
        };

        let resolved = resolve_request_environment(&request, &environment).unwrap();

        assert_eq!(resolved.url, "https://api.test/users");
        assert_eq!(resolved.headers[0].value, "Bearer abc");
    }

    #[test]
    fn loads_history_newest_first_with_masked_request_snapshot() {
        let root = test_workspace("load-history");
        let store = FileWorkspaceStore::new(&root);
        let request = ApiRequest {
            method: HttpMethod::Get,
            url: "https://api.test/users".to_string(),
            headers: vec![Header {
                key: "Authorization".to_string(),
                value: "Bearer secret-token".to_string(),
                enabled: true,
            }],
            auth: Auth::Bearer {
                token: "secret-token".to_string(),
            },
            ..ApiRequest::default()
        };

        let first = store.append_history(None, &request, None).unwrap();
        let mut second_request = request.clone();
        second_request.url = "https://api.test/projects".to_string();
        let second = store.append_history(None, &second_request, None).unwrap();

        let loaded = store.load_history().unwrap();

        assert_eq!(
            loaded.iter().map(|entry| &entry.id).collect::<Vec<_>>(),
            vec![&second.id, &first.id]
        );
        assert_eq!(loaded[0].request_snapshot.headers[0].value, "********");
        assert_eq!(
            loaded[0].request_snapshot.auth,
            Auth::Bearer {
                token: "********".to_string()
            }
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn clear_history_leaves_empty_history_file() {
        let root = test_workspace("clear-history");
        let store = FileWorkspaceStore::new(&root);
        let request = ApiRequest {
            method: HttpMethod::Get,
            url: "https://api.test/users".to_string(),
            ..ApiRequest::default()
        };
        store.append_history(None, &request, None).unwrap();

        store.clear_history().unwrap();

        assert!(store.load_history().unwrap().is_empty());
        assert!(root.join(".collections").join("history.jsonl").exists());
        let _ = fs::remove_dir_all(root);
    }
}
