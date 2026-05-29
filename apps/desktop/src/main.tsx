import { createMemo, createSignal, For, Show } from "solid-js";
import { render } from "solid-js/web";
import {
  executeRequest,
  exportCollectionJson,
  exportCollectionYaml,
  importCurl,
  importOpenApi,
  importPostmanCollection,
  loadCollections,
  saveCollection,
} from "./services/commands";
import type {
  ApiRequest,
  ApiResponse,
  Collection,
  CollectionFolder,
  Environment,
  EnvironmentVariable,
  HttpMethod,
  RequestHistoryItem,
  SavedRequest,
} from "./types";
import { RequestEditorTabs } from "./components/request/RequestEditorTabs";
import { ResponseViewer } from "./components/response/ResponseViewer";
import "./styles.css";

const methods: HttpMethod[] = ["Get", "Post", "Put", "Patch", "Delete"];
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
    scripts: { pre_request: "", post_request: "" },
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

function App() {
  const [sideView, setSideView] = createSignal<SideView>("Collections");
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
      const activeEnvironment: Environment = {
        id: "local",
        name: "Local",
        variables: environment(),
      };
      const result = await executeRequest({
        request,
        environment: activeEnvironment,
        root_path: workspacePath(),
        save_history: true,
      });
      setResponse(result.response);
      if (result.script_log.length > 0) {
        setMessage(result.script_log.join("\n"));
      }
      setHistory((items) => [
        {
          id: result.history?.id ?? id("history"),
          name: request.name ?? request.url,
          request: result.request,
          status: result.response.status,
          duration_ms: result.response.duration_ms,
          created_at: result.history?.created_at ?? new Date().toLocaleTimeString(),
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

  function activeCollection(): Collection | undefined {
    return collections().find((item) =>
      item.requests.some((request) => request.id === activeRequestId()),
    );
  }

  function downloadText(filename: string, text: string) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function onExport(format: "json" | "yaml") {
    const collection = activeCollection();
    if (!collection) return;
    const content =
      format === "json"
        ? await exportCollectionJson(collection)
        : await exportCollectionYaml(collection);
    downloadText(`${collection.name}.${format === "json" ? "json" : "yaml"}`, content);
    setMessage(`Exported ${collection.name} as ${format.toUpperCase()}.`);
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
          <button class="ghost-button" type="button" onClick={() => onExport("json")}>JSON</button>
          <button class="ghost-button" type="button" onClick={() => onExport("yaml")}>YAML</button>
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

            <RequestEditorTabs
              request={currentRequest()}
              message={message()}
              runtime={("__TAURI_INTERNALS__" in window) ? "Tauri" : "Browser"}
              updateRequest={updateRequest}
            />
          </section>

          <ResponseViewer response={response()} message={message()} />
        </section>
      </main>
    </div>
  );
}

render(() => <App />, document.getElementById("root") as HTMLElement);
