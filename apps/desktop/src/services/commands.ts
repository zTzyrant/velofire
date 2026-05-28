import type { ApiRequest, ApiResponse, Collection } from "../types";

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
    localStorage.setItem(`velofire:collection:${collection.id}`, JSON.stringify(collection));
    return "browser-local-storage";
  }
  return invoke<string>("save_collection", { rootPath, collection });
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
