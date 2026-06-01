import { For, Show, createEffect, createSignal } from "solid-js";
import type {
  ApiRequest,
  ApiResponse,
  Collection,
  CollectionFolder,
  EnvironmentVariable,
  HttpMethod,
} from "../../types";
import { RequestEditorTabs } from "../request/RequestEditorTabs";
import { ResponseViewer } from "../response/ResponseViewer";

const METHODS: HttpMethod[] = ["Get", "Post", "Put", "Patch", "Delete"];

function methodLabel(method: HttpMethod): string {
  return method.toUpperCase();
}

function methodClass(method: HttpMethod): string {
  switch (method) {
    case "Get":
      return "text-[var(--success)]";
    case "Post":
      return "text-[var(--primary)]";
    case "Put":
      return "text-[var(--tertiary)]";
    case "Patch":
      return "text-[var(--tertiary)]";
    case "Delete":
      return "text-[var(--error)]";
    default:
      return "text-[var(--text-muted)]";
  }
}

export interface MainPanelProps {
  currentRequest: ApiRequest;
  responsePlacement: "bottom" | "right";
  responsePercent: number;
  response: ApiResponse | null;
  message: string | null;
  loading: boolean;
  environmentName: string;
  environmentVariables: EnvironmentVariable[];
  resourceSelection:
    | { type: "request"; requestId: string }
    | { type: "collection"; collectionId: string }
    | { type: "folder"; collectionId: string; folderId: string };
  collections: Collection[];
  onSend: () => void;
  onUpdateRequest: (updater: (request: ApiRequest) => ApiRequest) => void;
  onSelectRequest: (requestId: string) => void;
  onUpdateCollectionMetadata: (collectionId: string, metadata: Record<string, string>) => void;
  onUpdateFolderMetadata: (collectionId: string, folderId: string, metadata: Record<string, string>) => void;
  onStartResponseResize: (event: MouseEvent) => void;
}

export function MainPanel(props: MainPanelProps) {
  const [editingName, setEditingName] = createSignal(false);
  const [nameDraft, setNameDraft] = createSignal(props.currentRequest.name ?? "Untitled");

  createEffect(() => {
    if (!editingName()) setNameDraft(props.currentRequest.name ?? "Untitled");
  });

  function commitName() {
    const name = nameDraft().trim() || "Untitled";
    props.onUpdateRequest((request) => ({ ...request, name }));
    setEditingName(false);
  }

  return (
    <Show
      when={props.resourceSelection.type === "request"}
      fallback={
        <ResourceOverview
          selection={props.resourceSelection}
          collections={props.collections}
          onSelectRequest={props.onSelectRequest}
          onUpdateCollectionMetadata={props.onUpdateCollectionMetadata}
          onUpdateFolderMetadata={props.onUpdateFolderMetadata}
        />
      }
    >
    <section
      class={`grid h-full min-h-0 grid-cols-[minmax(0,1fr)] ${
        props.responsePlacement === "right"
          ? "!grid-rows-[36px_44px_minmax(0,1fr)] !grid-cols-[minmax(280px,1fr)_6px_minmax(280px,1fr)]"
          : ""
      }`}
      style={{
        "grid-template-rows":
          props.responsePlacement === "bottom"
            ? `36px 44px minmax(180px, ${100 - props.responsePercent}fr) 6px minmax(180px, ${props.responsePercent}fr)`
            : "36px 44px minmax(0, 1fr)",
        "grid-template-columns":
          props.responsePlacement === "right"
            ? `minmax(280px, ${100 - props.responsePercent}fr) 6px minmax(280px, ${props.responsePercent}fr)`
            : "minmax(0, 1fr)",
      }}
    >
      {/* Row 1: Request title and action */}
      <div class="flex min-w-0 items-center justify-between gap-3 overflow-hidden border-b border-[var(--outline-soft)] bg-[var(--surface)] px-3" role="toolbar" aria-label="Request toolbar">
        <div class="flex min-w-0 items-center gap-2">
          <span class={`inline-block shrink-0 rounded px-1.5 py-0.5 text-xs font-bold uppercase leading-none ${methodClass(props.currentRequest.method)}`}>
            {methodLabel(props.currentRequest.method)}
          </span>
          <Show
            when={editingName()}
            fallback={
              <button
                class="min-w-0 max-w-[320px] truncate rounded border border-transparent bg-transparent px-1.5 py-0.5 text-left text-sm font-medium text-[var(--text)] hover:border-[var(--outline-soft)] hover:bg-[var(--surface-high)] hover:shadow-none"
                type="button"
                title="Double click to rename"
                onDblClick={() => setEditingName(true)}
              >
                {props.currentRequest.name ?? "Untitled"}
              </button>
            }
          >
            <input
              class="h-7 w-[260px] rounded border-[var(--primary-strong)] bg-[var(--surface-lowest)] px-2 text-sm font-medium"
              value={nameDraft()}
              autofocus
              onInput={(event) => setNameDraft(event.currentTarget.value)}
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitName();
                if (event.key === "Escape") {
                  setNameDraft(props.currentRequest.name ?? "Untitled");
                  setEditingName(false);
                }
              }}
            />
          </Show>
        </div>
        <button
          class="h-7 shrink-0 rounded bg-[var(--primary-strong)] px-4 text-xs font-semibold text-white hover:bg-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={props.onSend}
          disabled={props.loading}
        >
          {props.loading ? "Sending" : "Send"}
        </button>
      </div>

      {/* Row 2: URL bar */}
      <div class="flex items-center gap-2 border-b border-[var(--outline-soft)] bg-[var(--surface)] px-3 py-2">
        <select
          aria-label="HTTP method"
          class={`rounded bg-[var(--surface-lowest)] px-2 py-1.5 text-sm font-bold uppercase outline-none ${methodClass(props.currentRequest.method)}`}
          value={props.currentRequest.method}
          onInput={(event) =>
            props.onUpdateRequest((request) => ({
              ...request,
              method: event.currentTarget.value as HttpMethod,
            }))
          }
        >
          <For each={METHODS}>
            {(method) => <option value={method}>{methodLabel(method)}</option>}
          </For>
        </select>
        <input
          type="url"
          class="flex-1 rounded bg-[var(--surface-lowest)] px-3 py-1.5 text-sm text-[var(--text)] outline-none placeholder:text-[color-mix(in_srgb,var(--text-muted)_50%,transparent)] focus:ring-1 focus:ring-[var(--primary-strong)]"
          value={props.currentRequest.url}
          aria-label="Request URL"
          placeholder="https://api.example.com/endpoint"
          onInput={(event) =>
            props.onUpdateRequest((request) => ({
              ...request,
              url: event.currentTarget.value,
            }))
          }
        />
      </div>

      {/* Row 3: Request editor */}
      <div class="min-h-0 overflow-hidden">
        <RequestEditorTabs
          request={props.currentRequest}
          environmentName={props.environmentName.trim() || "Local"}
          environmentVariables={props.environmentVariables}
          message={props.message}
          runtime={"__TAURI_INTERNALS__" in window ? "Tauri" : "Browser"}
          updateRequest={props.onUpdateRequest}
        />
      </div>

      {/* Row 4: Splitter */}
      <button
        class={`cursor-pointer border border-[var(--outline-soft)] p-0 ${
          props.responsePlacement === "right"
            ? "cursor-col-resize bg-[var(--surface-lowest)] hover:bg-[color-mix(in_srgb,var(--primary-strong)_28%,transparent)]"
            : "cursor-row-resize bg-[var(--surface-lowest)] hover:bg-[color-mix(in_srgb,var(--primary-strong)_28%,transparent)]"
        }`}
        type="button"
        aria-label="Resize response panel"
        onMouseDown={props.onStartResponseResize}
      />

      {/* Row 5: Response viewer */}
      <div class="overflow-auto min-h-0">
        <ResponseViewer response={props.response} message={props.message} />
      </div>
    </section>
    </Show>
  );
}

type ResourceTab = "Overview" | "Authorization" | "Scripts" | "Variables";

function resourceMetadata(
  selection: MainPanelProps["resourceSelection"],
  collections: Collection[],
): { title: string; kind: string; collection?: Collection; folder?: CollectionFolder; metadata: Record<string, string> } {
  if (selection.type === "folder") {
    const collection = collections.find((item) => item.id === selection.collectionId);
    const folder = collection?.folders.find((item) => item.id === selection.folderId);
    return { title: folder?.name ?? "Folder", kind: "Folder", collection, folder, metadata: folder?.metadata ?? {} };
  }
  const collection = collections.find((item) => item.id === selection.collectionId);
  return { title: collection?.name ?? "Collection", kind: "Collection", collection, metadata: collection?.metadata ?? {} };
}

function metadataVariables(metadata: Record<string, string>): EnvironmentVariable[] {
  return Object.entries(metadata)
    .filter(([key]) => key.startsWith("variable."))
    .map(([key, value]) => ({ key: key.slice("variable.".length), value, enabled: true, is_secret: false }));
}

function ResourceOverview(props: {
  selection: Exclude<MainPanelProps["resourceSelection"], { type: "request" }>;
  collections: Collection[];
  onSelectRequest: (requestId: string) => void;
  onUpdateCollectionMetadata: (collectionId: string, metadata: Record<string, string>) => void;
  onUpdateFolderMetadata: (collectionId: string, folderId: string, metadata: Record<string, string>) => void;
}) {
  const [tab, setTab] = createSignal<ResourceTab>("Overview");
  const current = () => resourceMetadata(props.selection, props.collections);
  const updateMetadata = (metadata: Record<string, string>) => {
    if (props.selection.type === "folder") {
      props.onUpdateFolderMetadata(props.selection.collectionId, props.selection.folderId, metadata);
      return;
    }
    props.onUpdateCollectionMetadata(props.selection.collectionId, metadata);
  };
  const setMeta = (key: string, value: string) => updateMetadata({ ...current().metadata, [key]: value });
  const requests = () => {
    const resource = current();
    if (!resource.collection) return [];
    return props.selection.type === "folder"
      ? resource.collection.requests.filter((request) => request.folder_id === props.selection.folderId)
      : resource.collection.requests;
  };

  function addVariable() {
    const base = "variable.name";
    let key = base;
    let index = 1;
    while (current().metadata[key] !== undefined) {
      key = `variable.name_${index++}`;
    }
    setMeta(key, "");
  }

  function updateVariable(oldKey: string, nextName: string, value: string) {
    const next = { ...current().metadata };
    delete next[oldKey];
    next[`variable.${nextName.trim() || "name"}`] = value;
    updateMetadata(next);
  }

  return (
    <section class="grid h-full min-h-0 grid-rows-[42px_1fr] bg-[var(--bg)]">
      <header class="flex items-center justify-between border-b border-[var(--outline-soft)] bg-[var(--surface)] px-3">
        <div class="min-w-0">
          <div class="text-[10px] font-semibold uppercase text-[var(--text-muted)]">{current().kind}</div>
          <h2 class="m-0 truncate text-sm font-semibold text-[var(--text)]">{current().title}</h2>
        </div>
        <div class="text-xs text-[var(--text-muted)]">{requests().length} request(s)</div>
      </header>
      <div class="min-h-0 overflow-auto">
        <nav class="flex h-10 items-end gap-1 border-b border-[var(--outline-soft)] px-3">
          <For each={["Overview", "Authorization", "Scripts", "Variables"] as ResourceTab[]}>
            {(item) => (
              <button class={`panel-tab ${tab() === item ? "active" : ""}`} type="button" onClick={() => setTab(item)}>
                {item}
                <Show when={item === "Variables" && metadataVariables(current().metadata).length > 0}>
                  <span class="count">{metadataVariables(current().metadata).length}</span>
                </Show>
              </button>
            )}
          </For>
        </nav>
        <div class="grid gap-3 p-4">
          <Show when={tab() === "Overview"}>
            <div class="grid max-w-3xl gap-3">
              <label class="field-stack">
                <span>Description</span>
                <textarea
                  class="body-textarea h-24"
                  value={current().metadata.description ?? ""}
                  onInput={(event) => setMeta("description", event.currentTarget.value)}
                />
              </label>
              <div class="two-column-fields">
                <label class="field-stack">
                  <span>Author</span>
                  <input value={current().metadata.author_name ?? ""} onInput={(event) => setMeta("author_name", event.currentTarget.value)} />
                </label>
                <label class="field-stack">
                  <span>Email</span>
                  <input value={current().metadata.author_email ?? ""} onInput={(event) => setMeta("author_email", event.currentTarget.value)} />
                </label>
              </div>
              <label class="field-stack">
                <span>Documentation URL</span>
                <input value={current().metadata.documentation_url ?? ""} onInput={(event) => setMeta("documentation_url", event.currentTarget.value)} />
              </label>
              <div class="grid gap-1">
                <div class="panel-title">Requests</div>
                <For each={requests()}>
                  {(request) => (
                    <button class="resource-request-row" type="button" onClick={() => props.onSelectRequest(request.id)}>
                      <span>{request.request.method.toUpperCase()}</span>
                      <strong>{request.name}</strong>
                      <code>{request.request.url}</code>
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>
          <Show when={tab() === "Authorization"}>
            <div class="empty-state h-40">Collection and folder authorization inheritance is prepared in metadata. Request-level auth still overrides at send time.</div>
          </Show>
          <Show when={tab() === "Scripts"}>
            <div class="grid max-w-3xl gap-3">
              <label class="field-stack">
                <span>Pre-request script</span>
                <textarea class="body-textarea h-32" value={current().metadata.pre_request_script ?? ""} onInput={(event) => setMeta("pre_request_script", event.currentTarget.value)} />
              </label>
              <label class="field-stack">
                <span>Post-request script</span>
                <textarea class="body-textarea h-32" value={current().metadata.post_request_script ?? ""} onInput={(event) => setMeta("post_request_script", event.currentTarget.value)} />
              </label>
            </div>
          </Show>
          <Show when={tab() === "Variables"}>
            <div class="key-value-table max-w-3xl">
              <div class="table-head"><span>Key</span><span>Value</span><span>On</span></div>
              <div class="table-body">
                <For each={metadataVariables(current().metadata)}>
                  {(variable) => {
                    const metaKey = () => `variable.${variable.key}`;
                    return (
                      <div class="table-row">
                        <input value={variable.key} onInput={(event) => updateVariable(metaKey(), event.currentTarget.value, variable.value)} />
                        <input value={variable.value} onInput={(event) => setMeta(metaKey(), event.currentTarget.value)} />
                        <span class="row-actions">on</span>
                      </div>
                    );
                  }}
                </For>
              </div>
              <button class="table-add" type="button" onClick={addVariable}>Add variable</button>
            </div>
          </Show>
        </div>
      </div>
    </section>
  );
}
