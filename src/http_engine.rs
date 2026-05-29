use crate::models::{
    ApiKeyLocation, ApiRequest, ApiResponse, Auth, FormField, Header, HttpMethod, QueryParam,
    RequestBody,
};
use base64::Engine;
use reqwest::header::{CONTENT_TYPE, HeaderMap, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use thiserror::Error;
use url::Url;

#[derive(Debug, Error, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", content = "message", rename_all = "snake_case")]
pub enum RestError {
    #[error("validation error: {0}")]
    Validation(String),
    #[error("authentication configuration error: {0}")]
    Auth(String),
    #[error("network error: {0}")]
    Network(String),
    #[error("request timed out")]
    Timeout,
    #[error("tls error: {0}")]
    Tls(String),
    #[error("response body error: {0}")]
    Body(String),
}

pub type RestResult<T> = Result<T, RestError>;

pub struct RestClient {
    client: reqwest::Client,
}

impl RestClient {
    pub fn new() -> RestResult<Self> {
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::limited(10))
            .build()
            .map_err(|error| RestError::Network(error.to_string()))?;

        Ok(Self { client })
    }

    pub async fn send(&self, request: ApiRequest) -> RestResult<ApiResponse> {
        let started_at_ms = now_ms();
        let timer = std::time::Instant::now();
        let prepared = prepare_request(request)?;

        let mut builder = self
            .client
            .request(prepared.method.as_reqwest_method(), prepared.url)
            .headers(prepared.headers)
            .timeout(Duration::from_millis(prepared.timeout_ms));

        builder = match prepared.body {
            RequestBody::None => builder,
            RequestBody::Json { value } => {
                builder =
                    ensure_content_type(builder, "application/json", prepared.has_content_type);
                builder.json(&value)
            }
            RequestBody::FormData { fields } => {
                let form = enabled_fields(fields)
                    .into_iter()
                    .fold(reqwest::multipart::Form::new(), |form, (key, value)| {
                        form.text(key, value)
                    });
                builder.multipart(form)
            }
            RequestBody::UrlEncoded { fields } => {
                let form = enabled_fields(fields);
                builder = ensure_content_type(
                    builder,
                    "application/x-www-form-urlencoded",
                    prepared.has_content_type,
                );
                builder.form(&form)
            }
            RequestBody::RawText { value } => builder.body(value),
            RequestBody::Xml { value } => {
                builder =
                    ensure_content_type(builder, "application/xml", prepared.has_content_type);
                builder.body(value)
            }
        };

        let response = builder.send().await.map_err(map_reqwest_error)?;
        let status = response.status();
        let status_text = status.canonical_reason().unwrap_or("").to_string();
        let final_url = response.url().to_string();
        let headers = response_headers(response.headers());
        let content_type = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .map(ToOwned::to_owned);
        let body_bytes = response
            .bytes()
            .await
            .map_err(|error| RestError::Body(error.to_string()))?;
        let body_bytes_len = body_bytes.len();
        let body = body_bytes.to_vec();
        let body_text = String::from_utf8_lossy(&body).into_owned();
        let finished_at_ms = now_ms();

        Ok(ApiResponse {
            status: status.as_u16(),
            status_text,
            headers,
            body,
            body_text,
            body_bytes_len,
            content_type,
            duration_ms: timer.elapsed().as_millis(),
            started_at_ms,
            finished_at_ms,
            final_url,
        })
    }
}

pub async fn send_request(request: ApiRequest) -> RestResult<ApiResponse> {
    RestClient::new()?.send(request).await
}

struct PreparedRequest {
    method: HttpMethod,
    url: Url,
    headers: HeaderMap,
    body: RequestBody,
    timeout_ms: u64,
    has_content_type: bool,
}

fn prepare_request(mut request: ApiRequest) -> RestResult<PreparedRequest> {
    if request.timeout_ms == 0 {
        return Err(RestError::Validation(
            "timeout_ms must be greater than zero".to_string(),
        ));
    }

    apply_auth(&mut request)?;

    let mut url = Url::parse(&request.url)
        .map_err(|error| RestError::Validation(format!("invalid url: {error}")))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err(RestError::Validation(format!(
            "unsupported url scheme: {}",
            url.scheme()
        )));
    }

    for param in request.query_params.iter().filter(|param| param.enabled) {
        if !param.key.trim().is_empty() {
            url.query_pairs_mut()
                .append_pair(param.key.trim(), &param.value);
        }
    }

    let mut headers = HeaderMap::new();
    let mut has_content_type = false;
    for header in request.headers.iter().filter(|header| header.enabled) {
        if header.key.trim().is_empty() {
            continue;
        }
        if header.key.eq_ignore_ascii_case("content-type") {
            has_content_type = true;
        }
        let name = HeaderName::from_bytes(header.key.trim().as_bytes())
            .map_err(|error| RestError::Validation(format!("invalid header name: {error}")))?;
        let value = HeaderValue::from_str(&header.value)
            .map_err(|error| RestError::Validation(format!("invalid header value: {error}")))?;
        headers.append(name, value);
    }

    Ok(PreparedRequest {
        method: request.method,
        url,
        headers,
        body: request.body,
        timeout_ms: request.timeout_ms,
        has_content_type,
    })
}

fn apply_auth(request: &mut ApiRequest) -> RestResult<()> {
    match &request.auth {
        Auth::None => {}
        Auth::Bearer { token } => {
            if token.trim().is_empty() {
                return Err(RestError::Auth("bearer token is empty".to_string()));
            }
            upsert_header(
                &mut request.headers,
                "Authorization",
                format!("Bearer {}", token.trim()),
            );
        }
        Auth::Basic { username, password } => {
            if username.is_empty() {
                return Err(RestError::Auth("basic auth username is empty".to_string()));
            }
            let encoded =
                base64::engine::general_purpose::STANDARD.encode(format!("{username}:{password}"));
            upsert_header(
                &mut request.headers,
                "Authorization",
                format!("Basic {encoded}"),
            );
        }
        Auth::ApiKey {
            key,
            value,
            location,
        } => {
            if key.trim().is_empty() {
                return Err(RestError::Auth("api key name is empty".to_string()));
            }
            match location {
                ApiKeyLocation::Header => {
                    upsert_header(&mut request.headers, key.trim(), value.clone())
                }
                ApiKeyLocation::Query => request.query_params.push(QueryParam {
                    key: key.trim().to_string(),
                    value: value.clone(),
                    enabled: true,
                }),
            }
        }
    }
    Ok(())
}

fn upsert_header(headers: &mut Vec<Header>, key: impl Into<String>, value: impl Into<String>) {
    let key = key.into();
    if let Some(existing) = headers
        .iter_mut()
        .find(|header| header.key.eq_ignore_ascii_case(&key))
    {
        existing.value = value.into();
        existing.enabled = true;
    } else {
        headers.push(Header {
            key,
            value: value.into(),
            enabled: true,
        });
    }
}

fn ensure_content_type(
    builder: reqwest::RequestBuilder,
    content_type: &'static str,
    already_set: bool,
) -> reqwest::RequestBuilder {
    if already_set {
        builder
    } else {
        builder.header(CONTENT_TYPE, content_type)
    }
}

fn enabled_fields(fields: Vec<FormField>) -> Vec<(String, String)> {
    fields
        .into_iter()
        .filter(|field| field.enabled && !field.key.trim().is_empty())
        .map(|field| (field.key.trim().to_string(), field.value))
        .collect()
}

fn response_headers(headers: &HeaderMap) -> Vec<Header> {
    headers
        .iter()
        .map(|(name, value)| Header {
            key: name.as_str().to_string(),
            value: value.to_str().unwrap_or("<binary>").to_string(),
            enabled: true,
        })
        .collect()
}

fn map_reqwest_error(error: reqwest::Error) -> RestError {
    if error.is_timeout() {
        RestError::Timeout
    } else if error.to_string().to_ascii_lowercase().contains("tls") {
        RestError::Tls(error.to_string())
    } else {
        RestError::Network(error.to_string())
    }
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

pub fn mask_sensitive_headers(headers: &[Header]) -> Vec<Header> {
    headers
        .iter()
        .map(|header| {
            let mut masked = header.clone();
            if is_sensitive_header(&masked.key) {
                masked.value = "********".to_string();
            }
            masked
        })
        .collect()
}

fn is_sensitive_header(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "authorization" | "cookie" | "x-api-key" | "x-auth-token"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{ApiKeyLocation, Auth};

    fn request_with_auth(auth: Auth) -> ApiRequest {
        ApiRequest {
            id: Some("request_1".to_string()),
            name: Some("Example".to_string()),
            path: Vec::new(),
            method: HttpMethod::Get,
            url: "https://example.com".to_string(),
            headers: Vec::new(),
            body: RequestBody::None,
            auth,
            scripts: Default::default(),
            metadata: Default::default(),
            timeout_ms: 30_000,
            query_params: Vec::new(),
        }
    }

    #[test]
    fn applies_bearer_auth_header() {
        let mut request = request_with_auth(Auth::Bearer {
            token: "abc".to_string(),
        });

        apply_auth(&mut request).unwrap();

        assert_eq!(request.headers[0].key, "Authorization");
        assert_eq!(request.headers[0].value, "Bearer abc");
    }

    #[test]
    fn applies_api_key_query() {
        let mut request = request_with_auth(Auth::ApiKey {
            key: "api_key".to_string(),
            value: "secret".to_string(),
            location: ApiKeyLocation::Query,
        });

        apply_auth(&mut request).unwrap();

        assert_eq!(request.query_params[0].key, "api_key");
    }

    #[test]
    fn masks_sensitive_headers() {
        let masked = mask_sensitive_headers(&[Header {
            key: "Authorization".to_string(),
            value: "Bearer token".to_string(),
            enabled: true,
        }]);

        assert_eq!(masked[0].value, "********");
    }
}
