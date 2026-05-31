import { Show, For, type JSX, createSignal } from "solid-js";
import type {
  HttpMethod,
  ApiRequest,
  Collection,
  CollectionFolder,
  SavedRequest,
  EnvironmentVariable,
  Environment,
  ImportReport,
  RequestHistoryItem,
} from "../../types";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

export type SideView = "Collections" | "History" | "Environments" | "Imports";

interface SidebarProps {
  sideView: SideView;
  collections: Collection[];
  activeRequestId: string;
  collapsedCollections: Set<string>;
  collapsedFolders: Set<string>;
  history: RequestHistoryItem[];
  environmentName: string;
  environment: EnvironmentVariable[];
  savedEnvironments: Environment[];
  importText: string;
  lastImportReport: ImportReport | null;
  onToggleCollection: (id: string) => void;
  onToggleFolder: (id: string) => void;
  onSetActiveRequest: (id: string) => void;
  onNewCollection: () => void;
  onNewRequest: (collectionId?: string, folderId?: string) => void;
  onContextMenu: (event: MouseEvent, title: string, items: any[]) => void;
  requestContextItems: (saved: SavedRequest) => any[];
  collectionContextItems: (collection: Collection) => any[];
  folderContextItems: (collection: Collection, folder: CollectionFolder) => any[];
  historyContextItems: (item: RequestHistoryItem) => any[];
  onLoadHistory: () => void;
  onClearHistory: () => void;
  onReplayHistoryItem: (item: RequestHistoryItem) => void;
  onLoadEnvironments: () => void;
  onSaveEnvironment: () => void;
  onSetEnvironmentName: (name: string) => void;
  onSetEnvironment: (updater: (items: EnvironmentVariable[]) => EnvironmentVariable[]) => void;
  onApplyEnvironment: (env: Environment) => void;
  onSetImportText: (text: string) => void;
  onImportCurl: () => void;
  onImportCollection: (format: "postman" | "openapi") => void;
  onMoveRequest: (requestId: string, folderId?: string) => void;
}

function methodLabel(method: HttpMethod): string {
  return method.toUpperCase();
}

function methodClass(method: HttpMethod): string {
  switch (method) {
    case "Get": return "text-[var(--success)]";
    case "Post": return "text-[var(--primary)]";
    case "Put": return "text-[var(--tertiary)]";
    case "Patch": return "text-[var(--tertiary)]";
    case "Delete": return "text-[var(--error)]";
    default: return "text-[var(--text-muted)]";
  }
}

function truncate(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
}

function bodySummary(body: ApiRequest["body"]): string | null {
  if (body.type === "none") return null;
  if (body.type === "json") {
    const value = typeof body.value === "string" ? body.value : JSON.stringify(body.value);
    return value && value !== "{}" ? `JSON ${truncate(value, 80)}` : "JSON {}";
  }
  if (body.type === "raw_text" || body.type === "xml") {
    return body.value.trim() ? `${body.type === "xml" ? "XML" : "Raw"} ${truncate(body.value.trim(), 80)}` : null;
  }
  const enabledFields = body.fields.filter((field) => field.enabled && field.key.trim());
  return enabledFields.length > 0
    ? `${body.type === "form_data" ? "Form" : "URL Encoded"} ${enabledFields.length} field(s)`
    : null;
}

const SIDEBAR_TOOL =
  "inline-flex items-center justify-center h-6 min-w-0 rounded-[5px] border border-[var(--outline-soft)] px-2 cursor-default text-[11px] font-medium whitespace-nowrap w-full overflow-hidden text-ellipsis bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-high)] hover:text-[var(--text)]";

const COLLECTION_FOLDER_ROW =
  "grid grid-cols-[18px_minmax(0,1fr)] items-center w-full h-6 border-0 rounded bg-transparent text-[var(--text-muted)] text-left gap-0.5 px-0.5 hover:bg-[var(--surface-high)] hover:text-[var(--text)]";

const REQUEST_ROW =
  "grid grid-cols-[34px_minmax(0,1fr)] items-center w-full h-6 border-0 rounded bg-transparent text-[var(--text-muted)] text-left pl-5 hover:bg-[var(--surface-high)] hover:text-[var(--text)] cursor-grab active:cursor-grabbing select-none";

let dndPayload: { requestId: string; folderId?: string } | null = null;

export function Sidebar(props: SidebarProps) {
  const [draggingId, setDraggingId] = createSignal<string | null>(null);
  const [dropTargetId, setDropTargetId] = createSignal<string | null>(null);

  function handleDragStart(event: DragEvent, requestId: string, folderId?: string) {
    dndPayload = { requestId, folderId };
    setDraggingId(requestId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", JSON.stringify({ requestId, folderId }));
    }
    (event.currentTarget as HTMLElement).classList.add("dragging");
  }

  function handleDragEnd(event: DragEvent) {
    (event.currentTarget as HTMLElement).classList.remove("dragging");
    setDraggingId(null);
    setDropTargetId(null);
    // Keep payload briefly in case drop fires after dragEnd
    setTimeout(() => { dndPayload = null; }, 500);
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  }

  function handleDragEnter(_event: DragEvent, targetId: string) {
    setDropTargetId(targetId);
  }

  function handleDragLeave(event: DragEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDropTargetId(null);
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDropTargetId(null);
    setDraggingId(null);

    const payload = dndPayload;
    dndPayload = null;

    if (!payload) return;

    // Find drop target element using event coordinates (more reliable than event.target in Tauri)
    const x = event.clientX;
    const y = event.clientY;
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return;

    // Walk up to find folder or root
    const folderEl = el.closest('[data-dnd-folder]') as HTMLElement | null;
    const rootEl = el.closest('[data-dnd-root]') as HTMLElement | null;
    const collectionEl = el.closest('[data-dnd-collection]') as HTMLElement | null;

    if (!collectionEl) return;

    const targetFolderId = folderEl?.dataset.dndFolder || undefined;

    if (payload.folderId === targetFolderId) return;
    if (!payload.folderId && !targetFolderId) return;

    props.onMoveRequest(payload.requestId, targetFolderId);
  }

  return (
    <aside class="grid grid-rows-[30px_1fr] min-h-0 border-r border-[var(--outline-soft)] bg-[var(--surface-low)]">
      <div class="flex justify-between gap-1.5 px-2 py-0 min-w-0 border-b border-[var(--outline-soft)]">
        <span class="text-[var(--text-muted)] text-[11px] font-medium uppercase tracking-wide">
          {props.sideView}
        </span>
        <Show when={props.sideView === "Collections"}>
          <Button
            variant="secondary"
            size="icon"
            type="button"
            aria-label="New collection"
            title="New collection"
            onClick={() => props.onNewCollection()}
          >
            +
          </Button>
        </Show>
      </div>

      <Show when={props.sideView === "Collections"}>
        <div class="overflow-auto p-[5px] min-w-0 min-h-0"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <For each={props.collections}>
            {(collection) => (
              <section data-dnd-collection={collection.id}>
                {/* Collection header (not draggable, not droppable) */}
                <div
                  class={cn(COLLECTION_FOLDER_ROW, "cursor-pointer")}
                  onClick={() => props.onToggleCollection(collection.id)}
                  onContextMenu={(event) =>
                    props.onContextMenu(event, collection.name, props.collectionContextItems(collection))
                  }
                >
                  <button
                    class={cn(
                      "inline-grid w-[18px] h-[22px] place-items-center border-0 rounded bg-transparent text-[var(--text-muted)] font-mono text-[11px] leading-none p-0 transition-[transform,color,background] duration-120 hover:bg-[var(--surface-high)] hover:text-[var(--text)]",
                      props.collapsedCollections.has(collection.id) && "-rotate-90",
                    )}
                    type="button"
                    aria-label={props.collapsedCollections.has(collection.id) ? "Expand collection" : "Collapse collection"}
                    aria-expanded={!props.collapsedCollections.has(collection.id)}
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onToggleCollection(collection.id);
                    }}
                  >
                    v
                  </button>
                  <span class="overflow-hidden text-ellipsis whitespace-nowrap" title={collection.name}>
                    {collection.name}
                  </span>
                </div>

                <Show when={!props.collapsedCollections.has(collection.id)}>
                  {/* Root droppable area */}
                  <div
                    data-dnd-root=""
                    data-dnd-collection={collection.id}
                    class={cn(
                      "min-h-[8px] transition-colors duration-150",
                      dropTargetId() === `root-${collection.id}` && "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] border-l-2 border-[var(--primary)]",
                    )}
                    onDragEnter={(e) => handleDragEnter(e, `root-${collection.id}`)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => {
                      e.stopPropagation();
                      handleDrop(e);
                    }}
                  >
                    {/* Requests in root */}
                    <For each={collection.requests.filter((saved) => !saved.folder_id)}>
                      {(saved) => (
                        <div
                          class={cn(
                            REQUEST_ROW,
                            "draggable-request",
                            draggingId() === saved.id && "dragging",
                            saved.id === props.activeRequestId &&
                              "bg-[color-mix(in_srgb,var(--primary)_11%,transparent)] shadow-[inset_2px_0_0_var(--primary)] text-[var(--text)]",
                          )}
                          draggable={true}
                          data-dnd-request={saved.id}
                          data-dnd-request-folder=""
                          onDragStart={(e) => handleDragStart(e, saved.id, undefined)}
                          onDragEnd={handleDragEnd}
                          onClick={() => props.onSetActiveRequest(saved.id)}
                          onContextMenu={(event) =>
                            props.onContextMenu(event, saved.name, props.requestContextItems(saved))
                          }
                        >
                          <span class={cn("inline-grid place-items-center rounded font-mono text-[11px] font-semibold", methodClass(saved.request.method))}>
                            {methodLabel(saved.request.method)}
                          </span>
                          <span class="overflow-hidden text-ellipsis whitespace-nowrap">
                            {saved.name}
                          </span>
                        </div>
                      )}
                    </For>
                  </div>

                  {/* Folders */}
                  <For each={[...collection.folders].sort((a, b) => a.sort_order - b.sort_order)}>
                    {(folder) => (
                      <div class="mt-px">
                        {/* Folder header - droppable */}
                        <div
                          data-dnd-folder={folder.id}
                          data-dnd-collection={collection.id}
                          class={cn(
                            COLLECTION_FOLDER_ROW,
                            "droppable-folder",
                            dropTargetId() === `folder-${collection.id}-${folder.id}` && "drag-over",
                            "mt-px pl-2.5 cursor-pointer",
                          )}
                          onClick={() => props.onToggleFolder(folder.id)}
                          onContextMenu={(event) =>
                            props.onContextMenu(event, folder.name, props.folderContextItems(collection, folder))
                          }
                          onDragEnter={(e) => handleDragEnter(e, `folder-${collection.id}-${folder.id}`)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => {
                            e.stopPropagation();
                            handleDrop(e);
                          }}
                        >
                          <button
                            class={cn(
                              "inline-grid w-[18px] h-[22px] place-items-center border-0 rounded bg-transparent text-[var(--text-muted)] font-mono text-[11px] leading-none p-0 transition-[transform,color,background] duration-120 hover:bg-[var(--surface-high)] hover:text-[var(--text)]",
                              props.collapsedFolders.has(folder.id) && "-rotate-90",
                            )}
                            type="button"
                            aria-label={props.collapsedFolders.has(folder.id) ? "Expand folder" : "Collapse folder"}
                            aria-expanded={!props.collapsedFolders.has(folder.id)}
                            onClick={(event) => {
                              event.stopPropagation();
                              props.onToggleFolder(folder.id);
                            }}
                          >
                            v
                          </button>
                          <span class="overflow-hidden text-ellipsis whitespace-nowrap" title={folder.name}>
                            {folder.name}
                          </span>
                        </div>

                        {/* Requests inside folder */}
                        <Show when={!props.collapsedFolders.has(folder.id)}>
                          <For each={collection.requests.filter((saved) => saved.folder_id === folder.id)}>
                            {(saved) => (
                              <div
                                class={cn(
                                  REQUEST_ROW,
                                  "draggable-request",
                                  draggingId() === saved.id && "dragging",
                                  saved.id === props.activeRequestId &&
                                    "bg-[color-mix(in_srgb,var(--primary)_11%,transparent)] shadow-[inset_2px_0_0_var(--primary)] text-[var(--text)]",
                                )}
                                draggable={true}
                                data-dnd-request={saved.id}
                                data-dnd-request-folder={folder.id}
                                onDragStart={(e) => handleDragStart(e, saved.id, folder.id)}
                                onDragEnd={handleDragEnd}
                                onClick={() => props.onSetActiveRequest(saved.id)}
                                onContextMenu={(event) =>
                                  props.onContextMenu(event, saved.name, props.requestContextItems(saved))
                                }
                              >
                                <span class={cn("inline-grid place-items-center rounded font-mono text-[11px] font-semibold", methodClass(saved.request.method))}>
                                  {methodLabel(saved.request.method)}
                                </span>
                                <span class="overflow-hidden text-ellipsis whitespace-nowrap">
                                  {saved.name}
                                </span>
                              </div>
                            )}
                          </For>
                        </Show>
                      </div>
                    )}
                  </For>
                </Show>
              </section>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.sideView === "History"}>
        <div class="overflow-auto p-[5px]">
          <div class="grid grid-cols-2 gap-[5px]">
            <button class={SIDEBAR_TOOL} type="button" onClick={() => props.onLoadHistory()}>
              Load history
            </button>
            <button class={SIDEBAR_TOOL} type="button" onClick={() => props.onClearHistory()}>
              Clear history
            </button>
          </div>
          <Show
            when={props.history.length > 0}
            fallback={
              <div class="grid min-h-[120px] place-items-center p-4 text-[var(--text-muted)] text-xs text-center overflow-wrap-anywhere min-h-[72px] border border-dashed border-[color-mix(in_srgb,var(--outline-soft)_65%,transparent)] rounded-[6px] bg-[color-mix(in_srgb,var(--surface)_42%,transparent)]">
                No requests have been sent in this workspace yet.
              </div>
            }
          >
            <For each={props.history}>
              {(item) => (
                <button
                  class={cn(REQUEST_ROW, "grid-cols-[42px_minmax(0,1fr)] items-start pl-0")}
                  type="button"
                  onClick={() => props.onReplayHistoryItem(item)}
                  onContextMenu={(event) =>
                    props.onContextMenu(event, item.name, props.historyContextItems(item))
                  }
                >
                  <span class="inline-grid place-items-center rounded font-mono text-[11px] font-semibold text-[var(--success)]">
                    {item.status ?? "..."}
                  </span>
                  <span class="grid gap-0.5 min-w-0 overflow-hidden">
                    <span class="overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text)]">
                      {item.name}
                    </span>
                    <span class="overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-muted)] font-mono text-[10px] leading-[14px]">
                      {methodLabel(item.request.method)} {item.request.url}
                    </span>
                    <Show when={bodySummary(item.request.body)}>
                      {(summary) => (
                        <span class="overflow-hidden text-ellipsis whitespace-nowrap text-[var(--tertiary)] font-mono text-[10px] leading-[14px]">
                          {summary()}
                        </span>
                      )}
                    </Show>
                  </span>
                </button>
              )}
            </For>
          </Show>
        </div>
      </Show>

      <Show when={props.sideView === "Environments"}>
        <div class="grid gap-2 p-2.5">
          <label class="grid gap-1 min-w-0">
            <span class="text-[var(--text-muted)] text-[11px] font-medium">Name</span>
            <input
              class="h-[30px] rounded-[6px] px-2 font-mono text-xs"
              value={props.environmentName}
              onInput={(event) => props.onSetEnvironmentName(event.currentTarget.value)}
            />
          </label>
          <div class="grid grid-cols-2 gap-[5px]">
            <button class={SIDEBAR_TOOL} type="button" onClick={() => props.onLoadEnvironments()}>
              Load
            </button>
            <button class={SIDEBAR_TOOL} type="button" onClick={() => props.onSaveEnvironment()}>
              Save
            </button>
          </div>
          <Show
            when={props.savedEnvironments.length > 0}
            fallback={
              <div class="grid min-h-[120px] place-items-center p-4 text-[var(--text-muted)] text-xs text-center overflow-wrap-anywhere min-h-[48px] p-2.5 border border-dashed border-[color-mix(in_srgb,var(--outline-soft)_65%,transparent)] rounded-[6px] bg-[color-mix(in_srgb,var(--surface)_42%,transparent)]">
                No saved environments loaded.
              </div>
            }
          >
            <div class="grid gap-0.5 min-w-0">
              <For each={props.savedEnvironments}>
                {(item) => (
                  <button
                    class={cn(REQUEST_ROW, "pl-0")}
                    type="button"
                    onClick={() => props.onApplyEnvironment(item)}
                  >
                    <span>{item.variables.length}</span>
                    <span>{item.name}</span>
                  </button>
                )}
              </For>
            </div>
          </Show>
          <For each={props.environment}>
            {(variable, index) => (
              <label class="grid gap-1">
                <input
                  class="h-[30px] rounded-[6px] px-2 font-mono text-xs"
                  value={variable.key}
                  onInput={(event) =>
                    props.onSetEnvironment((items) =>
                      items.map((item, row) =>
                        row === index() ? { ...item, key: event.currentTarget.value } : item,
                      ),
                    )
                  }
                />
                <input
                  class="h-[30px] rounded-[6px] px-2 font-mono text-xs"
                  type={variable.is_secret ? "password" : "text"}
                  value={variable.value}
                  onInput={(event) =>
                    props.onSetEnvironment((items) =>
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
            class={SIDEBAR_TOOL}
            type="button"
            onClick={() =>
              props.onSetEnvironment((items) => [
                ...items,
                { key: "", value: "", is_secret: false, enabled: true },
              ])
            }
          >
            Add variable
          </button>
        </div>
      </Show>

      <Show when={props.sideView === "Imports"}>
        <div class="grid gap-2 p-2.5">
          <p class="text-[var(--text-muted)] text-xs leading-[18px] m-0">
            Imports create an unsaved collection. Save after reviewing generated requests.
          </p>
          <textarea
            class="h-44 resize-none border border-[var(--outline-soft)] rounded-[6px] bg-[var(--surface-lowest)] font-mono text-xs leading-[18px] outline-none p-2"
            value={props.importText}
            onInput={(event) => props.onSetImportText(event.currentTarget.value)}
            placeholder="Paste cURL, Postman JSON, or OpenAPI JSON/YAML"
          />
          <button class={SIDEBAR_TOOL} type="button" onClick={() => props.onImportCurl()}>
            Import cURL
          </button>
          <button
            class={SIDEBAR_TOOL}
            type="button"
            onClick={() => props.onImportCollection("postman")}
          >
            Import Postman
          </button>
          <button
            class={SIDEBAR_TOOL}
            type="button"
            onClick={() => props.onImportCollection("openapi")}
          >
            Import OpenAPI
          </button>
          <Show
            when={props.lastImportReport}
            fallback={
              <div class="grid min-h-[120px] place-items-center p-4 text-[var(--text-muted)] text-xs text-center overflow-wrap-anywhere min-h-[72px] border border-dashed border-[color-mix(in_srgb,var(--outline-soft)_65%,transparent)] rounded-[6px] bg-[color-mix(in_srgb,var(--surface)_42%,transparent)]">
                Paste an import source and choose a format to preview results here.
              </div>
            }
          >
            {(report) => (
              <div class="grid gap-2 min-w-0 mt-2 pt-2 border-t border-[color-mix(in_srgb,var(--outline-soft)_55%,transparent)]">
                <div class="text-[var(--text-muted)] text-[11px] font-medium uppercase">Last Import</div>
                <dl class="grid gap-1 m-0">
                  <div class="flex justify-between gap-2 text-[var(--text-muted)] text-[11px]">
                    <dt>Format</dt>
                    <dd class="min-w-0 m-0 overflow-wrap-anywhere font-mono text-[var(--text)]">
                      {report().source_format}
                    </dd>
                  </div>
                  <div class="flex justify-between gap-2 text-[var(--text-muted)] text-[11px]">
                    <dt>Requests</dt>
                    <dd class="min-w-0 m-0 overflow-wrap-anywhere font-mono text-[var(--text)]">
                      {report().imported_request_count}
                    </dd>
                  </div>
                  <div class="flex justify-between gap-2 text-[var(--text-muted)] text-[11px]">
                    <dt>Warnings</dt>
                    <dd class="min-w-0 m-0 overflow-wrap-anywhere font-mono text-[var(--text)]">
                      {report().warnings.length}
                    </dd>
                  </div>
                  <div class="flex justify-between gap-2 text-[var(--text-muted)] text-[11px]">
                    <dt>Unsupported</dt>
                    <dd class="min-w-0 m-0 overflow-wrap-anywhere font-mono text-[var(--text)]">
                      {report().unsupported.length}
                    </dd>
                  </div>
                </dl>
                <Show when={report().warnings.length > 0}>
                  <div class="grid gap-1.5">
                    <For each={report().warnings.slice(0, 4)}>
                      {(warning) => (
                        <code class="max-w-full overflow-hidden px-1.5 py-0.5 border border-[color-mix(in_srgb,var(--warning)_50%,transparent)] rounded bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--warning)] font-mono text-[11px] text-ellipsis whitespace-nowrap">
                          {warning}
                        </code>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={report().unsupported.length > 0}>
                  <div class="grid gap-1.5">
                    <For each={report().unsupported.slice(0, 4)}>
                      {(item) => (
                        <code class="max-w-full overflow-hidden px-1.5 py-0.5 border border-[color-mix(in_srgb,var(--warning)_50%,transparent)] rounded bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--warning)] font-mono text-[11px] text-ellipsis whitespace-nowrap">
                          {item.name}
                        </code>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            )}
          </Show>
        </div>
      </Show>
    </aside>
  );
}
