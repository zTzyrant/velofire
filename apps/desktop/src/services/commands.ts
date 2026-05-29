import type { ApiRequest, ApiResponse, Collection, ExecuteRequestInput, ExecuteRequestOutput } from "../types";

type Invoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

async function getInvoke(): Promise<Invoke | null> {
  if (!("__TAURI_INTERNALS__" in window)) {
    return null;
  }
  const api = await import("@tauri-apps/api/core");
  return api.invoke;
}

export async function sendRequest(request: ApiRequest): Promise<ApiResponse> {
  const invoke = await getInvoke();
  if (!invoke) {
    return {
      status: 200,
      status_text: "Preview",
      headers: [{ key: "content-type", value: "application/json", enabled: true }],
      body_text: JSON.stringify(
        {
          status: "preview",
          message: "Run inside Tauri to send native Rust requests.",
          request: { method: request.method, url: request.url },
        },
        null,
        2,
      ),
      body_bytes_len: 128,
      duration_ms: 0,
      started_at_ms: Date.now(),
      finished_at_ms: Date.now(),
      final_url: request.url,
    };
  }
  return invoke<ApiResponse>("send_request", { request });
}

export async function executeRequest(input: ExecuteRequestInput): Promise<ExecuteRequestOutput> {
  const invoke = await getInvoke();
  if (!invoke) {
    const response = await sendRequest(input.request);
    return {
      request: input.request,
      response,
      script_log: [],
    };
  }
  return invoke<ExecuteRequestOutput>("execute_request", { input });
}

export async function loadCollections(rootPath: string): Promise<Collection[]> {
  const invoke = await getInvoke();
  if (!invoke) {
    const prefix = "velofire:collection:";
    return Object.entries(localStorage)
      .filter(([key]) => key.startsWith(prefix))
      .map(([, value]) => JSON.parse(value) as Collection);
  }
  return invoke<Collection[]>("load_collections", { rootPath });
}

export async function saveCollection(rootPath: string, collection: Collection): Promise<string> {
  const invoke = await getInvoke();
  if (!invoke) {
    localStorage.setItem(`velofire:collection:${collection.id}`, JSON.stringify(sanitizeCollection(collection)));
    return "browser-local-storage";
  }
  return invoke<string>("save_collection", { rootPath, collection });
}

export async function exportCollectionJson(collection: Collection): Promise<string> {
  const invoke = await getInvoke();
  if (!invoke) {
    return JSON.stringify(sanitizeCollection(collection), null, 2);
  }
  return invoke<string>("export_collection_json", { collection });
}

export async function exportCollectionYaml(collection: Collection): Promise<string> {
  const invoke = await getInvoke();
  if (!invoke) {
    return collectionToYaml(sanitizeCollection(collection));
  }
  return invoke<string>("export_collection_yaml", { collection });
}

export async function importCurl(command: string): Promise<ApiRequest> {
  const invoke = await getInvoke();
  if (!invoke) {
    const url = command.match(/https?:\/\/[^\s'"]+/)?.[0] ?? "https://httpbin.org/get";
    return {
      id: `curl-${Date.now()}`,
      name: "Imported cURL",
      path: ["Imported"],
      method: command.includes("-X POST") ? "Post" : "Get",
      url,
      query_params: [],
      headers: [],
      body: { type: "none" },
      auth: { type: "none" },
      scripts: { pre_request: "", post_request: "" },
      timeout_ms: 30000,
      metadata: {},
    };
  }
  return invoke<ApiRequest>("import_curl", { command });
}

export async function importPostmanCollection(content: string): Promise<Collection> {
  const invoke = await getInvoke();
  if (!invoke) {
    throw new Error("Postman import requires the Tauri desktop runtime.");
  }
  return invoke<Collection>("import_postman_collection", { content });
}

export async function importOpenApi(content: string): Promise<Collection> {
  const invoke = await getInvoke();
  if (!invoke) {
    throw new Error("OpenAPI import requires the Tauri desktop runtime.");
  }
  return invoke<Collection>("import_openapi", { content });
}

function collectionToYaml(value: unknown, indent = 0): string {
  const pad = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => {
        const rendered = collectionToYaml(item, indent + 2);
        return typeof item === "object" && item !== null
          ? `${pad}- ${rendered.trimStart()}`
          : `${pad}- ${rendered}`;
      })
      .join("\n");
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return entries
      .map(([key, item]) => {
        if (item && typeof item === "object") {
          return `${pad}${key}:\n${collectionToYaml(item, indent + 2)}`;
        }
        return `${pad}${key}: ${collectionToYaml(item, 0)}`;
      })
      .join("\n");
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (value === undefined) {
    return "null";
  }
  return String(value);
}

function sanitizeCollection(collection: Collection): Collection {
  return {
    ...collection,
    requests: collection.requests.map((saved) => ({
      ...saved,
      request: {
        ...saved.request,
        headers: saved.request.headers.map((header) =>
          isSensitiveName(header.key) ? { ...header, value: "********" } : header,
        ),
        auth: sanitizeAuth(saved.request.auth),
      },
    })),
  };
}

function sanitizeAuth(auth: ApiRequest["auth"]): ApiRequest["auth"] {
  if (auth.type === "bearer") return { ...auth, token: "********" };
  if (auth.type === "basic") return { ...auth, password: "********" };
  if (auth.type === "api_key") return { ...auth, value: "********" };
  return auth;
}

function isSensitiveName(name: string): boolean {
  return ["authorization", "cookie", "x-api-key", "x-auth-token"].includes(name.toLowerCase());
}
