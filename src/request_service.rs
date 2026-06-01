use crate::http_engine;
use crate::models::{ApiRequest, ApiResponse, Environment, RequestHistoryEntry};
use crate::workspace::{self, FileWorkspaceStore};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::process::Command;
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExecuteRequestInput {
    pub request: ApiRequest,
    #[serde(default)]
    pub environment: Option<Environment>,
    #[serde(default)]
    pub root_path: Option<String>,
    #[serde(default)]
    pub save_history: bool,
    #[serde(default)]
    pub allow_node_scripts: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteRequestOutput {
    pub request: ApiRequest,
    pub response: ApiResponse,
    #[serde(default)]
    pub history: Option<RequestHistoryEntry>,
    #[serde(default)]
    pub script_log: Vec<String>,
    #[serde(default)]
    pub environment_updates: BTreeMap<String, String>,
}

#[derive(Debug, Error)]
pub enum RequestServiceError {
    #[error("{0}")]
    Rest(#[from] http_engine::RestError),
    #[error("{0}")]
    Workspace(#[from] workspace::WorkspaceError),
    #[error("script error: {0}")]
    Script(String),
}

pub type RequestServiceResult<T> = Result<T, RequestServiceError>;

pub async fn execute_request(
    input: ExecuteRequestInput,
) -> RequestServiceResult<ExecuteRequestOutput> {
    let mut script_context = ScriptContext::from_environment(input.environment.as_ref());
    let mut request = input.request;
    let pre_request_script = request.scripts.pre_request.clone();
    run_script_runtime(
        "pre_request",
        &pre_request_script,
        &mut request,
        None,
        &mut script_context,
        input.allow_node_scripts,
    )?;

    if let Some(environment) = &input.environment {
        request = workspace::resolve_request_environment(&request, environment)?;
    }

    let response = http_engine::send_request(request.clone()).await?;
    let post_request_script = request.scripts.post_request.clone();
    run_script_runtime(
        "post_request",
        &post_request_script,
        &mut request,
        Some(&response),
        &mut script_context,
        input.allow_node_scripts,
    )?;

    let history = if input.save_history {
        if let Some(root_path) = input.root_path.filter(|path| !path.trim().is_empty()) {
            Some(
                FileWorkspaceStore::new(PathBuf::from(root_path)).append_history(
                    None,
                    &request,
                    Some(&response),
                )?,
            )
        } else {
            None
        }
    } else {
        None
    };

    Ok(ExecuteRequestOutput {
        request,
        response,
        history,
        script_log: script_context.log,
        environment_updates: script_context.updates,
    })
}

fn run_script_runtime(
    label: &str,
    script: &str,
    request: &mut ApiRequest,
    response: Option<&ApiResponse>,
    context: &mut ScriptContext,
    allow_node_scripts: bool,
) -> RequestServiceResult<()> {
    if request
        .metadata
        .get("script_runtime")
        .is_some_and(|runtime| runtime == "node")
    {
        if !allow_node_scripts {
            return Err(RequestServiceError::Script(format!(
                "{label}: Node.js sandbox is disabled for this run"
            )));
        }
        return run_node_script(label, script, request, response, context);
    }
    run_script(label, script, request, response, context)
}

#[derive(Debug, Default)]
struct ScriptContext {
    variables: BTreeMap<String, String>,
    updates: BTreeMap<String, String>,
    log: Vec<String>,
}

impl ScriptContext {
    fn from_environment(environment: Option<&Environment>) -> Self {
        let variables = environment
            .map(|environment| {
                environment
                    .variables
                    .iter()
                    .filter(|variable| variable.enabled)
                    .map(|variable| (variable.key.clone(), variable.value.clone()))
                    .collect()
            })
            .unwrap_or_default();
        Self {
            variables,
            updates: BTreeMap::new(),
            log: Vec::new(),
        }
    }
}

fn run_script(
    label: &str,
    script: &str,
    request: &mut ApiRequest,
    response: Option<&ApiResponse>,
    context: &mut ScriptContext,
) -> RequestServiceResult<()> {
    for (index, line) in script.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("//") || line.starts_with('#') {
            continue;
        }

        let Some((command, rest)) = line.split_once(' ') else {
            return Err(RequestServiceError::Script(format!(
                "{label}: line {} is missing arguments",
                index + 1
            )));
        };
        let args = parse_args(rest).map_err(|error| {
            RequestServiceError::Script(format!("{label}: line {} {error}", index + 1))
        })?;

        match command {
            "set_header" if args.len() == 2 => {
                upsert_header(
                    request,
                    &args[0],
                    &resolve_value(&args[1], response, context),
                );
            }
            "set_env" if args.len() == 2 => {
                let value = resolve_value(&args[1], response, context);
                context.variables.insert(args[0].clone(), value.clone());
                context.updates.insert(args[0].clone(), value);
            }
            "log" if args.len() == 1 => {
                context.log.push(resolve_value(&args[0], response, context))
            }
            _ => {
                return Err(RequestServiceError::Script(format!(
                    "{label}: line {} unsupported command '{command}'",
                    index + 1
                )));
            }
        }
    }
    Ok(())
}

fn parse_args(input: &str) -> Result<Vec<String>, &'static str> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut chars = input.chars().peekable();
    let mut quote = None;

    while let Some(ch) = chars.next() {
        match (quote, ch) {
            (Some(q), c) if c == q => quote = None,
            (Some(_), '\\') => {
                if let Some(next) = chars.next() {
                    current.push(next);
                }
            }
            (Some(_), c) => current.push(c),
            (None, '"' | '\'') => quote = Some(ch),
            (None, c) if c.is_whitespace() => {
                if !current.is_empty() {
                    args.push(std::mem::take(&mut current));
                }
            }
            (None, c) => current.push(c),
        }
    }

    if quote.is_some() {
        return Err("has an unclosed quote");
    }
    if !current.is_empty() {
        args.push(current);
    }
    Ok(args)
}

fn resolve_value(value: &str, response: Option<&ApiResponse>, context: &ScriptContext) -> String {
    let mut resolved = value.to_string();
    for (key, variable) in &context.variables {
        resolved = resolved.replace(&format!("{{{{{key}}}}}"), variable);
    }
    if let Some(response) = response {
        resolved = resolved
            .replace("{{response.status}}", &response.status.to_string())
            .replace(
                "{{response.duration_ms}}",
                &response.duration_ms.to_string(),
            )
            .replace("{{response.body}}", &response.body_text);
    }
    resolved
}

fn upsert_header(request: &mut ApiRequest, key: &str, value: &str) {
    if let Some(header) = request
        .headers
        .iter_mut()
        .find(|header| header.key.eq_ignore_ascii_case(key))
    {
        header.value = value.to_string();
        header.enabled = true;
    } else {
        request.headers.push(crate::models::Header {
            key: key.to_string(),
            value: value.to_string(),
            enabled: true,
        });
    }
}

#[derive(Debug, Deserialize)]
struct NodeScriptResult {
    #[serde(default)]
    request: Option<ApiRequest>,
    #[serde(default)]
    updates: BTreeMap<String, String>,
    #[serde(default)]
    log: Vec<String>,
}

fn run_node_script(
    label: &str,
    script: &str,
    request: &mut ApiRequest,
    response: Option<&ApiResponse>,
    context: &mut ScriptContext,
) -> RequestServiceResult<()> {
    if script.trim().is_empty() {
        return Ok(());
    }
    let payload = serde_json::json!({
        "label": label,
        "script": script,
        "request": request,
        "response": response,
        "variables": context.variables,
    });
    let bridge = r#"
const input = JSON.parse(process.env.VELOFIRE_SCRIPT_INPUT || "{}");
const crypto = require("crypto");
const request = input.request || {};
const response = input.response || null;
const variables = Object.assign({}, input.variables || {});
const updates = {};
const log = [];
function upsertHeader(key, value) {
  request.headers = Array.isArray(request.headers) ? request.headers : [];
  const found = request.headers.find((header) => String(header.key || "").toLowerCase() === String(key).toLowerCase());
  if (found) {
    found.value = String(value);
    found.enabled = true;
  } else {
    request.headers.push({ key: String(key), value: String(value), enabled: true });
  }
}
const vf = {
  request,
  response,
  crypto,
  env: {
    get: (key) => variables[String(key)],
    set: (key, value) => {
      variables[String(key)] = String(value);
      updates[String(key)] = String(value);
    },
  },
  setEnv: (key, value) => {
    variables[String(key)] = String(value);
    updates[String(key)] = String(value);
  },
  setHeader: upsertHeader,
  log: (...items) => log.push(items.map((item) => typeof item === "string" ? item : JSON.stringify(item)).join(" ")),
};
(async () => {
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  await new AsyncFunction("vf", "request", "response", "crypto", input.script)(vf, request, response, crypto);
  process.stdout.write(JSON.stringify({ request, updates, log }));
})().catch((error) => {
  process.stderr.write(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
"#;
    let output = Command::new("node")
        .arg("-e")
        .arg(bridge)
        .env("VELOFIRE_SCRIPT_INPUT", payload.to_string())
        .output()
        .map_err(|error| {
            RequestServiceError::Script(format!("{label}: failed to start Node.js: {error}"))
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(RequestServiceError::Script(format!(
            "{label}: Node.js script failed: {}",
            if stderr.is_empty() {
                "unknown error"
            } else {
                &stderr
            }
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let result: NodeScriptResult = serde_json::from_str(stdout.trim()).map_err(|error| {
        RequestServiceError::Script(format!("{label}: invalid Node.js script result: {error}"))
    })?;
    if let Some(updated_request) = result.request {
        *request = updated_request;
    }
    context.variables.extend(result.updates.clone());
    context.updates.extend(result.updates);
    context.log.extend(result.log);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Header, HttpMethod, RequestBody};

    #[test]
    fn pre_request_script_sets_header() {
        let mut request = ApiRequest {
            method: HttpMethod::Get,
            url: "https://example.com".to_string(),
            body: RequestBody::None,
            ..ApiRequest::default()
        };
        request.scripts.pre_request = r#"set_header Authorization "Bearer {{token}}""#.to_string();
        let mut context = ScriptContext {
            variables: BTreeMap::from([("token".to_string(), "abc".to_string())]),
            updates: BTreeMap::new(),
            log: Vec::new(),
        };

        run_script(
            "pre_request",
            &request.scripts.pre_request.clone(),
            &mut request,
            None,
            &mut context,
        )
        .unwrap();

        assert_eq!(
            request.headers,
            vec![Header {
                key: "Authorization".to_string(),
                value: "Bearer abc".to_string(),
                enabled: true,
            }]
        );
    }

    #[test]
    fn node_script_can_set_header_env_and_log_when_node_exists() {
        if Command::new("node").arg("--version").output().is_err() {
            return;
        }
        let mut request = ApiRequest {
            method: HttpMethod::Get,
            url: "https://example.com".to_string(),
            body: RequestBody::None,
            ..ApiRequest::default()
        };
        request
            .metadata
            .insert("script_runtime".to_string(), "node".to_string());
        let script = r#"
const signature = vf.crypto.createHash("sha256").update("velofire").digest("hex");
vf.setHeader("X-Signature", signature);
vf.setEnv("signature", signature);
vf.log("signed", signature.slice(0, 8));
"#;
        let mut context = ScriptContext::default();

        run_script_runtime(
            "pre_request",
            script,
            &mut request,
            None,
            &mut context,
            true,
        )
        .unwrap();

        assert!(
            request
                .headers
                .iter()
                .any(|header| header.key == "X-Signature")
        );
        assert!(context.updates.contains_key("signature"));
        assert_eq!(context.log.len(), 1);
    }
}
