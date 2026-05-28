import { createMemo, createSignal, For, Show } from "solid-js";
import { render } from "solid-js/web";
import {
  importCurl,
  importOpenApi,
  importPostmanCollection,
  loadCollections,
  saveCollection,
  sendRequest,
} from "./services/commands";
import type {
  ApiRequest,
  ApiResponse,
  Collection,
  CollectionFolder,
  EnvironmentVariable,
  Auth,
  Header,
  HttpMethod,
  RequestBody,
  RequestHistoryItem,
  SavedRequest,
} from "./types";
import "./styles.css";

const methods: HttpMethod[] = ["Get", "Post", "Put", "Patch", "Delete"];
const tabs = ["Params", "Headers", "Auth", "Body"] as const;
type EditorTab = (typeof tabs)[number];
type SideView = "Collections" | "History" | "Environments" | "Imports";

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultRequest(name = "New Request"): ApiRequest {
  return {
    id: id("request"),
    name,
    path: ["Scratch"],
    method: "Get",
    url: "https://httpbin.org/get",
    query_params: [],
    headers: [{ key: "Accept", value: "application/json", enabled: true }],
    body: { type: "none" },
    auth: { type: "none" },
    timeout_ms: 30000,
    metadata: {},
  };
}

function defaultCollection(): Collection {
  const collectionId = id("collection");
  const request = defaultRequest("Get httpbin");
  return {
    id: collectionId,
    name: "Scratch",
    folders: [],
    requests: [savedRequest(request, collectionId)],
  };
}

function savedRequest(request: ApiRequest, collectionId?: string, folderId?: string): SavedRequest {
  return {
    id: request.id ?? id("saved"),
    collection_id: collectionId,
    folder_id: folderId,
    name: request.name ?? "Untitled",
    request: { ...request, path: folderId ? request.path : [] },
  };
}

function methodLabel(method: HttpMethod): string {
  return method.toUpperCase();
}

function methodClass(method: HttpMethod): string {
  return method === "Delete" ? "del" : method.toLowerCase();
}

function bodyText(body: RequestBody): string {
  if (body.type === "json") return JSON.stringify(body.value, null, 2);
  if (body.type === "raw_text" || body.type === "xml") return body.value;
  return "";
}

function applyBodyText(type: RequestBody["type"], value: string): RequestBody {
  if (type === "none") return { type: "none" };
  if (type === "json") {
    try {
      return { type: "json", value: JSON.parse(value || "{}") };
    } catch {
      return { type: "raw_text", value };
    }
  }
  if (type === "xml") return { type: "xml", value };
  return { type: "raw_text", value };
}

function resolveEnvironment(value: string, variables: EnvironmentVariable[]): string {
  return value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) => {
    const variable = variables.find((item) => item.enabled && item.key === key);
    return variable?.value ?? `{{${key}}}`;
  });
}

function App() {
  const [sideView, setSideView] = createSignal<SideView>("Collections");
  const [activeTab, setActiveTab] = createSignal<EditorTab>("Params");
  const [workspacePath, setWorkspacePath] = createSignal(localStorage.getItem("velofire:workspace") ?? ".");
  const [collections, setCollections] = createSignal<Collection[]>([defaultCollection()]);
  const [activeRequestId, setActiveRequestId] = createSignal(collections()[0].requests[0].id);
  const [response, setResponse] = createSignal<ApiResponse | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [message, setMessage] = createSignal<string | null>(null);
  const [history, setHistory] = createSignal<RequestHistoryItem[]>([]);
  const [importText, setImportText] = createSignal("");
  const [environment, setEnvironment] = createSignal<EnvironmentVariable[]>([
    { key: "base_url", value: "https://httpbin.org", is_secret: false, enabled: true },
    { key: "token", value: "", is_secret: true, enabled: true },
  ]);

  const currentRequest = createMemo(() => {
    for (const collection of collections()) {
      const saved = collection.requests.find((request) => request.id === activeRequestId());
      if (saved) return saved.request;
    }
    return collections()[0]?.requests[0]?.request ?? defaultRequest();
  });

  function updateRequest(updater: (request: ApiRequest) => ApiRequest) {
    const requestId = activeRequestId();
    setCollections((items) =>
      items.map((collection) => ({
        ...collection,
        requests: collection.requests.map((saved) => {
          if (saved.id !== requestId) return saved;
          const next = updater(saved.request);
          return { ...saved, id: next.id ?? saved.id, name: next.name ?? saved.name, request: next };
        }),
      })),
    );
  }

  function updateRow(kind: "query_params" | "headers", index: number, patch: Partial<Header>) {
    updateRequest((request) => ({
      ...request,
      [kind]: request[kind].map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    }));
  }

  function addRow(kind: "query_params" | "headers") {
    updateRequest((request) => ({
      ...request,
      [kind]: [...request[kind], { key: "", value: "", enabled: true }],
    }));
  }

  function removeRow(kind: "query_params" | "headers", index: number) {
    updateRequest((request) => ({
      ...request,
      [kind]: request[kind].filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function updateAuth(auth: Auth) {
    updateRequest((request) => ({ ...request, auth }));
  }

  function newCollection() {
    const collection = defaultCollection();
    collection.name = `Collection ${collections().length + 1}`;
    setCollections((items) => [...items, collection]);
    setActiveRequestId(collection.requests[0].id);
  }

  function newFolder(collectionId = collections()[0]?.id) {
    const collection = collections().find((item) => item.id === collectionId);
    if (!collection) return;

    const folder: CollectionFolder = {
      id: id("folder"),
      name: `Folder ${collection.folders.length + 1}`,
      sort_order: collection.folders.length,
    };
    setCollections((items) =>
      items.map((item) =>
        item.id === collectionId ? { ...item, folders: [...item.folders, folder] } : item,
      ),
    );
  }

  function newRequest(collectionId = collections()[0]?.id, folderId?: string) {
    const request = defaultRequest(`Request ${Date.now().toString().slice(-4)}`);
    const saved = savedRequest(request, collectionId, folderId);
    setCollections((items) =>
      items.map((collection) =>
        collection.id === collectionId
          ? { ...collection, requests: [...collection.requests, saved] }
          : collection,
      ),
    );
    setActiveRequestId(saved.id);
  }

  async function onSend() {
    setLoading(true);
    setMessage(null);
    try {
      const request = currentRequest();
      const resolved: ApiRequest = {
        ...request,
        url: resolveEnvironment(request.url, environment()),
        headers: request.headers.map((header) => ({
          ...header,
          value: resolveEnvironment(header.value, environment()),
        })),
      };
      const result = await sendRequest(resolved);
      setResponse(result);
      setHistory((items) => [
        {
          id: id("history"),
          name: request.name ?? request.url,
          request,
          status: result.status,
          duration_ms: result.duration_ms,
          created_at: new Date().toLocaleTimeString(),
        },
        ...items.slice(0, 49),
      ]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function onLoadCollections() {
    localStorage.setItem("velofire:workspace", workspacePath());
    const loaded = await loadCollections(workspacePath());
    if (loaded.length > 0) {
      setCollections(loaded);
      setActiveRequestId(loaded[0].requests[0]?.id ?? "");
      setMessage(`Loaded ${loaded.length} collection(s).`);
    } else {
      setMessage("No collections found in workspace.");
    }
  }

  async function onSaveActiveCollection() {
    const collection = collections().find((item) =>
      item.requests.some((request) => request.id === activeRequestId()),
    );
    if (!collection) return;
    localStorage.setItem("velofire:workspace", workspacePath());
    const path = await saveCollection(workspacePath(), collection);
    setMessage(`Saved ${collection.name} to ${path}.`);
  }

  async function onImportCurl() {
    const request = await importCurl(importText());
    const collectionId = id("collection");
    const collection: Collection = {
      id: collectionId,
      name: "Imported",
      folders: [],
      requests: [savedRequest(request, collectionId)],
    };
    setCollections((items) => [...items, collection]);
    setActiveRequestId(collection.requests[0].id);
    setSideView("Collections");
    setMessage("Imported cURL request.");
  }

  async function onImportCollection(format: "postman" | "openapi") {
    const collection =
      format === "postman"
        ? await importPostmanCollection(importText())
        : await importOpenApi(importText());
    setCollections((items) => [...items, collection]);
    setActiveRequestId(collection.requests[0]?.id ?? activeRequestId());
    setSideView("Collections");
    setMessage(`Imported ${collection.name}.`);
  }

  return (
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark">V</span>
          <span class="brand-name">Velofire</span>
        </div>
        <nav class="workspace-tabs" aria-label="Workspace">
          <For each={["Collections", "History", "Environments", "Imports"] as SideView[]}>
            {(view) => (
              <button
                class={`workspace-tab ${sideView() === view ? "active" : ""}`}
                type="button"
                onClick={() => setSideView(view)}
              >
                {view}
              </button>
            )}
          </For>
        </nav>
        <div class="topbar-actions">
          <label class="search-field workspace-field">
            <input
              value={workspacePath()}
              onInput={(event) => setWorkspacePath(event.currentTarget.value)}
              placeholder="Workspace path"
            />
          </label>
          <button class="ghost-button" type="button" onClick={onLoadCollections}>Load</button>
          <button class="ghost-button" type="button" onClick={onSaveActiveCollection}>Save</button>
          <button class="primary-button" type="button" onClick={onSend} disabled={loading()}>
            {loading() ? "Sending" : "Send"}
          </button>
        </div>
      </header>

      <main class="workspace">
        <aside class="sidebar">
          <div class="sidebar-header">
            <span class="section-label">{sideView()}</span>
            <Show when={sideView() === "Collections"}>
              <button class="icon-button" type="button" aria-label="New collection" onClick={newCollection}>+</button>
            </Show>
          </div>

          <Show when={sideView() === "Collections"}>
            <div class="collection-list">
              <For each={collections()}>
                {(collection) => (
                  <section class="collection-group">
                    <button class="collection-row open" type="button" onClick={() => newRequest(collection.id)}>
                      <span class="chevron">v</span>
                      <span class="folder">{collection.name}</span>
                    </button>
                    <For each={collection.requests}>
                      {(saved) => (
                        <button
                          class={`request-row ${saved.id === activeRequestId() ? "active" : ""}`}
                          type="button"
                          onClick={() => setActiveRequestId(saved.id)}
                        >
                          <span class={`method ${methodClass(saved.request.method)}`}>
                            {methodLabel(saved.request.method)}
                          </span>
                          <span>{saved.name}</span>
                        </button>
                      )}
                    </For>
                  </section>
                )}
              </For>
            </div>
          </Show>

          <Show when={sideView() === "History"}>
            <div class="collection-list">
              <For each={history()}>
                {(item) => (
                  <button
                    class="request-row history-row"
                    type="button"
                    onClick={() => {
                      const collection = collections()[0];
                      const saved = savedRequest({ ...item.request, id: id("request") });
                      setCollections((items) =>
                        items.map((candidate) =>
                          candidate.id === collection.id
                            ? { ...candidate, requests: [saved, ...candidate.requests] }
                            : candidate,
                        ),
                      );
                      setActiveRequestId(saved.id);
                    }}
                  >
                    <span class="method get">{item.status ?? "..."}</span>
                    <span>{item.name}</span>
                  </button>
                )}
              </For>
            </div>
          </Show>

          <Show when={sideView() === "Environments"}>
            <div class="side-form">
              <For each={environment()}>
                {(variable, index) => (
                  <label class="env-row">
                    <input
                      value={variable.key}
                      onInput={(event) =>
                        setEnvironment((items) =>
                          items.map((item, row) =>
                            row === index() ? { ...item, key: event.currentTarget.value } : item,
                          ),
                        )
                      }
                    />
                    <input
                      type={variable.is_secret ? "password" : "text"}
                      value={variable.value}
                      onInput={(event) =>
                        setEnvironment((items) =>
                          items.map((item, row) =>
                            row === index() ? { ...item, value: event.currentTarget.value } : item,
                          ),
                        )
                      }
                    />
                  </label>
                )}
              </For>
              <button
                class="sidebar-tool"
                type="button"
                onClick={() =>
                  setEnvironment((items) => [
                    ...items,
                    { key: "", value: "", is_secret: false, enabled: true },
                  ])
                }
              >
                Add variable
              </button>
            </div>
          </Show>

          <Show when={sideView() === "Imports"}>
            <div class="side-form">
              <textarea
                class="side-textarea"
                value={importText()}
                onInput={(event) => setImportText(event.currentTarget.value)}
                placeholder="Paste cURL, Postman JSON, or OpenAPI JSON/YAML"
              />
              <button class="sidebar-tool" type="button" onClick={onImportCurl}>Import cURL</button>
              <button class="sidebar-tool" type="button" onClick={() => onImportCollection("postman")}>
                Import Postman
              </button>
              <button class="sidebar-tool" type="button" onClick={() => onImportCollection("openapi")}>
                Import OpenAPI
              </button>
            </div>
          </Show>

          <div class="sidebar-footer">
            <button class="sidebar-tool" type="button">Environment: Local</button>
            <button class="sidebar-tool" type="button">Workspace: {workspacePath()}</button>
          </div>
        </aside>

        <section class="main-panel">
          <div class="request-tabs" role="tablist" aria-label="Open requests">
            <button class="request-tab active" type="button" role="tab">
              <span class={`method ${methodClass(currentRequest().method)}`}>
                {methodLabel(currentRequest().method)}
              </span>
              <span>{currentRequest().name}</span>
            </button>
            <button class="request-tab add-tab" type="button" aria-label="New request" onClick={() => newRequest()}>
              +
            </button>
          </div>

          <section class="request-editor">
            <div class="url-bar">
              <select
                aria-label="HTTP method"
                value={currentRequest().method}
                onInput={(event) =>
                  updateRequest((request) => ({ ...request, method: event.currentTarget.value as HttpMethod }))
                }
              >
                <For each={methods}>{(method) => <option value={method}>{methodLabel(method)}</option>}</For>
              </select>
              <input
                type="url"
                value={currentRequest().url}
                aria-label="Request URL"
                onInput={(event) => updateRequest((request) => ({ ...request, url: event.currentTarget.value }))}
              />
              <button class="primary-button" type="button" onClick={onSend} disabled={loading()}>
                {loading() ? "Sending" : "Send"}
              </button>
            </div>

            <div class="editor-grid">
              <div class="panel request-config">
                <div class="panel-tabs" role="tablist" aria-label="Request configuration">
                  <For each={tabs}>
                    {(tab) => (
                      <button
                        class={`panel-tab ${activeTab() === tab ? "active" : ""}`}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                      >
                        {tab}
                        <Show when={tab === "Headers"}>
                          <span class="count">{currentRequest().headers.length}</span>
                        </Show>
                      </button>
                    )}
                  </For>
                </div>

                <Show when={activeTab() === "Params"}>
                  <KeyValueTable
                    rows={currentRequest().query_params}
                    onUpdate={(index, patch) => updateRow("query_params", index, patch)}
                    onAdd={() => addRow("query_params")}
                    onRemove={(index) => removeRow("query_params", index)}
                  />
                </Show>

                <Show when={activeTab() === "Headers"}>
                  <KeyValueTable
                    rows={currentRequest().headers}
                    onUpdate={(index, patch) => updateRow("headers", index, patch)}
                    onAdd={() => addRow("headers")}
                    onRemove={(index) => removeRow("headers", index)}
                  />
                </Show>

                <Show when={activeTab() === "Auth"}>
                  <AuthEditor auth={currentRequest().auth} onChange={updateAuth} />
                </Show>

                <Show when={activeTab() === "Body"}>
                  <BodyEditor
                    body={currentRequest().body}
                    onChange={(body) => updateRequest((request) => ({ ...request, body }))}
                  />
                </Show>
              </div>
              <aside class="panel inspector">
                <div class="panel-title">Request</div>
                <dl class="meta-list">
                  <div><dt>Name</dt><dd>{currentRequest().name}</dd></div>
                  <div><dt>Auth</dt><dd>{currentRequest().auth.type}</dd></div>
                  <div><dt>Timeout</dt><dd>{currentRequest().timeout_ms / 1000}s</dd></div>
                  <div><dt>Runtime</dt><dd>{("__TAURI_INTERNALS__" in window) ? "Tauri" : "Browser"}</dd></div>
                </dl>
                <Show when={message()}>
                  <p class="panel-message">{message()}</p>
                </Show>
              </aside>
            </div>
          </section>

          <section class="response-viewer">
            <div class="response-header">
              <div class="response-meta">
                <Show when={response()} fallback={<span class="status-chip idle">Idle</span>}>
                  {(res) => (
                    <>
                      <span class="status-chip">{res().status} {res().status_text}</span>
                      <span>{res().duration_ms} ms</span>
                      <span>{res().body_bytes_len} B</span>
                    </>
                  )}
                </Show>
              </div>
              <div class="response-actions">
                <button
                  class="ghost-button"
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(response()?.body_text ?? "")}
                >
                  Copy
                </button>
              </div>
            </div>
            <div class="response-tabs" role="tablist" aria-label="Response views">
              <button class="panel-tab active" type="button">Body</button>
              <button class="panel-tab" type="button">Headers</button>
              <button class="panel-tab" type="button">Timeline</button>
            </div>
            <pre class="code-view" aria-label="Response body"><code>{message() ?? response()?.body_text ?? "{\n  \"status\": \"ready\"\n}"}</code></pre>
          </section>
        </section>
      </main>
    </div>
  );
}

function KeyValueTable(props: {
  rows: Header[];
  onUpdate: (index: number, patch: Partial<Header>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div class="key-value-table" aria-label="Key value editor">
      <div class="table-head">
        <span>Key</span>
        <span>Value</span>
        <span>On</span>
      </div>
      <For each={props.rows}>
        {(row, index) => (
          <label class="table-row">
            <input value={row.key} onInput={(event) => props.onUpdate(index(), { key: event.currentTarget.value })} />
            <input value={row.value} onInput={(event) => props.onUpdate(index(), { value: event.currentTarget.value })} />
            <span class="row-actions">
              <input
                type="checkbox"
                checked={row.enabled}
                onInput={(event) => props.onUpdate(index(), { enabled: event.currentTarget.checked })}
              />
              <button type="button" class="mini-button" onClick={() => props.onRemove(index())}>Remove</button>
            </span>
          </label>
        )}
      </For>
      <button class="table-add" type="button" onClick={props.onAdd}>Add row</button>
    </div>
  );
}

function AuthEditor(props: { auth: Auth; onChange: (auth: Auth) => void }) {
  return (
    <div class="form-panel">
      <select
        value={props.auth.type}
        onInput={(event) => {
          const type = event.currentTarget.value as Auth["type"];
          if (type === "none") props.onChange({ type: "none" });
          if (type === "bearer") props.onChange({ type: "bearer", token: "" });
          if (type === "basic") props.onChange({ type: "basic", username: "", password: "" });
          if (type === "api_key") props.onChange({ type: "api_key", key: "x-api-key", value: "", location: "header" });
        }}
      >
        <option value="none">None</option>
        <option value="bearer">Bearer Token</option>
        <option value="basic">Basic Auth</option>
        <option value="api_key">API Key</option>
      </select>
      <Show when={props.auth.type === "bearer" && props.auth}>
        {(auth) => (
          <input
            type="password"
            placeholder="Token"
            value={(auth() as Extract<Auth, { type: "bearer" }>).token}
            onInput={(event) => props.onChange({ type: "bearer", token: event.currentTarget.value })}
          />
        )}
      </Show>
      <Show when={props.auth.type === "basic" && props.auth}>
        {(auth) => {
          const basic = () => auth() as Extract<Auth, { type: "basic" }>;
          return (
            <>
              <input
                placeholder="Username"
                value={basic().username}
                onInput={(event) => props.onChange({ ...basic(), username: event.currentTarget.value })}
              />
              <input
                type="password"
                placeholder="Password"
                value={basic().password}
                onInput={(event) => props.onChange({ ...basic(), password: event.currentTarget.value })}
              />
            </>
          );
        }}
      </Show>
      <Show when={props.auth.type === "api_key" && props.auth}>
        {(auth) => {
          const apiKey = () => auth() as Extract<Auth, { type: "api_key" }>;
          return (
            <>
              <input value={apiKey().key} onInput={(event) => props.onChange({ ...apiKey(), key: event.currentTarget.value })} />
              <input
                type="password"
                value={apiKey().value}
                onInput={(event) => props.onChange({ ...apiKey(), value: event.currentTarget.value })}
              />
              <select
                value={apiKey().location}
                onInput={(event) => props.onChange({ ...apiKey(), location: event.currentTarget.value as "header" | "query" })}
              >
                <option value="header">Header</option>
                <option value="query">Query</option>
              </select>
            </>
          );
        }}
      </Show>
    </div>
  );
}

function BodyEditor(props: { body: RequestBody; onChange: (body: RequestBody) => void }) {
  const value = createMemo(() => bodyText(props.body));
  return (
    <div class="body-editor">
      <select
        value={props.body.type}
        onInput={(event) => props.onChange(applyBodyText(event.currentTarget.value as RequestBody["type"], value()))}
      >
        <option value="none">None</option>
        <option value="json">JSON</option>
        <option value="raw_text">Raw Text</option>
        <option value="xml">XML</option>
      </select>
      <textarea
        value={value()}
        disabled={props.body.type === "none"}
        onInput={(event) => props.onChange(applyBodyText(props.body.type, event.currentTarget.value))}
      />
    </div>
  );
}

render(() => <App />, document.getElementById("root") as HTMLElement);
