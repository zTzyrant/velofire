import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
import { render } from "solid-js/web";
import { Toaster, toast } from "solid-sonner";
import {
  executeRequest,
  exportCollectionJson,
  exportCollectionYaml,
  importCurl,
  importOpenApi,
  importPostmanCollection,
  initWorkspace,
  clearHistory,
  loadCollections,
  loadEnvironments,
  loadHistory,
  saveCollection,
  saveEnvironment,
  pickFolder,
} from "./services/commands";
import type {
  ApiRequest,
  ApiResponse,
  Collection,
  CollectionFolder,
  Environment,
  EnvironmentVariable,
  HttpMethod,
  ImportReport,
  RequestHistoryEntry,
  RequestHistoryItem,
  SavedRequest,
} from "./types";
import { Topbar, type AppMenuGroup } from "./components/layout/Topbar";
import { Sidebar } from "./components/sidebar/Sidebar";
import { MainPanel } from "./components/layout/MainPanel";
import { CommandPalette, type CommandAction } from "./components/common/CommandPalette";
import { ConsoleDrawer, type ConsoleLogItem, type ConsoleLogLevel } from "./components/common/ConsoleDrawer";
import AboutDialog from "./components/common/AboutDialog";
import GenericDialog, { type DialogState } from "./components/common/GenericDialog";
import { AppContextMenu, type ContextMenuItem, type ContextMenuState } from "./components/common/AppContextMenu";
import "solid-sonner/styles.css";
import "./styles.css";

type SideView = "Collections" | "History" | "Environments" | "Imports";
type ResponsePlacement = "bottom" | "right";
type ResourceSelection =
  | { type: "request"; requestId: string }
  | { type: "collection"; collectionId: string }
  | { type: "folder"; collectionId: string; folderId: string };

const workspaceStorageKey = "velofire:workspace";
const recentWorkspacesStorageKey = "velofire:recent-workspaces";
const maxRecentWorkspaces = 5;
const minSidebarWidth = 196;
const maxSidebarWidth = 420;
const minResponsePercent = 28;
const maxResponsePercent = 72;

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
    metadata: {},
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

function metadataVariables(metadata: Record<string, string> | undefined): EnvironmentVariable[] {
  return Object.entries(metadata ?? {})
    .filter(([key]) => key.startsWith("variable."))
    .map(([key, value]) => ({
      key: key.slice("variable.".length),
      value,
      is_secret: false,
      enabled: true,
    }))
    .filter((variable) => variable.key.trim());
}

function mergeScripts(...scripts: Array<{ pre_request?: string; post_request?: string } | undefined>) {
  return {
    pre_request: scripts.map((script) => script?.pre_request?.trim()).filter(Boolean).join("\n"),
    post_request: scripts.map((script) => script?.post_request?.trim()).filter(Boolean).join("\n"),
  };
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

function environmentId(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized ? `environment-${normalized}` : "environment-local";
}

function normalizedWorkspacePath(path: string): string {
  return path.trim() || ".";
}

function notifyMessage(message: string) {
  const lower = message.toLowerCase();
  const options = { duration: 2800 };
  if (lower.includes("failed") || lower.includes("error") || lower.includes("blocked")) {
    toast.error(message, options);
    return;
  }
  if (lower.includes("warning") || lower.includes("invalid") || lower.includes("missing")) {
    toast.warning(message, options);
    return;
  }
  if (lower.includes("loaded") || lower.includes("saved") || lower.includes("imported") || lower.includes("exported") || lower.includes("created") || lower.includes("renamed") || lower.includes("deleted") || lower.includes("moved") || lower.includes("cleared") || lower.includes("duplicated")) {
    toast.success(message, options);
    return;
  }
  toast.info(message, options);
}

function logLevelForMessage(message: string): ConsoleLogLevel {
  const lower = message.toLowerCase();
  if (lower.includes("failed") || lower.includes("error") || lower.includes("blocked")) return "error";
  if (lower.includes("warning") || lower.includes("invalid") || lower.includes("missing")) return "warning";
  return "info";
}

function formatHeaders(headers: { key: string; value: string; enabled?: boolean }[]): string {
  return headers
    .filter((header) => header.enabled !== false)
    .map((header) => `${header.key}: ${header.value}`)
    .join("\n");
}

function formatRequestBody(body: ApiRequest["body"]): string {
  if (body.type === "none") return "<none>";
  if (body.type === "json") return typeof body.value === "string" ? body.value : JSON.stringify(body.value, null, 2);
  if (body.type === "raw_text" || body.type === "xml") return body.value;
  return body.fields
    .filter((field) => field.enabled && field.key.trim())
    .map((field) => {
      if (body.type === "form_data" && (field.field_type ?? "text") === "file") {
        return `${field.key}=<file:${field.file_name || field.file_path || "selected"}>`;
      }
      return `${field.key}=${field.value}`;
    })
    .join("\n");
}

function formatNetworkRequest(request: ApiRequest): string {
  return [
    `${request.method.toUpperCase()} ${request.url}`,
    "",
    "Request Headers",
    formatHeaders(request.headers) || "<none>",
    "",
    "Request Body",
    formatRequestBody(request.body),
  ].join("\n");
}

function networkLogMessage(request: ApiRequest, response: ApiResponse): string {
  return `${request.method.toUpperCase()} ${response.final_url || request.url}`;
}

function formatNetworkExchange(request: ApiRequest, response: ApiResponse): string {
  return [
    formatNetworkRequest(request),
    "",
    `Response ${response.status} ${response.status_text}`,
    `Final URL: ${response.final_url}`,
    `Duration: ${response.duration_ms}ms`,
    `Body bytes: ${response.body_bytes_len}${response.body_truncated ? " (truncated)" : ""}`,
    "",
    "Response Headers",
    formatHeaders(response.headers) || "<none>",
    "",
    "Response Body",
    response.body_text || "<empty>",
  ].join("\n");
}

function readRecentWorkspacePaths(): string[] {
  const current = localStorage.getItem(workspaceStorageKey);
  try {
    const parsed = JSON.parse(localStorage.getItem(recentWorkspacesStorageKey) ?? "[]");
    if (Array.isArray(parsed)) {
      const paths = parsed.filter((value): value is string => typeof value === "string");
      return mergeRecentWorkspacePaths(current, paths);
    }
  } catch {
    // Ignore stale localStorage values from older previews.
  }
  return mergeRecentWorkspacePaths(current, []);
}

function mergeRecentWorkspacePaths(primary: string | null, paths: string[]): string[] {
  const seen = new Set<string>();
  const ordered = [primary, ...paths]
    .map((path) => normalizedWorkspacePath(path ?? ""))
    .filter((path) => {
      if (seen.has(path)) return false;
      seen.add(path);
      return true;
    });
  return ordered.slice(0, maxRecentWorkspaces);
}

function historyItemFromEntry(entry: RequestHistoryEntry): RequestHistoryItem {
  return {
    id: entry.id,
    name: entry.request_snapshot.name ?? entry.request_snapshot.url,
    request: entry.request_snapshot,
    response: entry.response_snapshot,
    status: entry.response_snapshot?.status,
    duration_ms: entry.response_snapshot?.duration_ms,
    created_at: entry.created_at,
  };
}

function App() {
  const [sideView, setSideView] = createSignal<SideView>("Collections");
  const [commandPaletteOpen, setCommandPaletteOpen] = createSignal(false);
  const [consoleOpen, setConsoleOpen] = createSignal(false);
  const [aboutOpen, setAboutOpen] = createSignal(false);
  const [dialog, setDialog] = createSignal<DialogState | null>(null);
  const initialRecentWorkspaces = readRecentWorkspacePaths();
  const [workspacePath, setWorkspacePath] = createSignal(initialRecentWorkspaces[0] ?? ".");
  const [recentWorkspaces, setRecentWorkspaces] = createSignal(initialRecentWorkspaces);
  const [collections, setCollections] = createSignal<Collection[]>([defaultCollection()]);
  const [activeRequestId, setActiveRequestId] = createSignal(collections()[0].requests[0].id);
  const [resourceSelection, setResourceSelection] = createSignal<ResourceSelection>({
    type: "request",
    requestId: collections()[0].requests[0].id,
  });
  const [sidebarVisible, setSidebarVisible] = createSignal(true);
  const [inspectorVisible, setInspectorVisible] = createSignal(true);
  const [responsePlacement, setResponsePlacement] = createSignal<ResponsePlacement>("bottom");
  const [sidebarWidth, setSidebarWidth] = createSignal(252);
  const [responsePercent, setResponsePercent] = createSignal(57);
  const [response, setResponse] = createSignal<ApiResponse | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [message, setMessage] = createSignal<string | null>(null);
  const [consoleLogs, setConsoleLogs] = createSignal<ConsoleLogItem[]>([]);
  const [history, setHistory] = createSignal<RequestHistoryItem[]>([]);
  const [importText, setImportText] = createSignal("");
  const [lastImportReport, setLastImportReport] = createSignal<ImportReport | null>(null);
  const [contextMenu, setContextMenu] = createSignal<ContextMenuState | null>(null);
  const [collapsedCollections, setCollapsedCollections] = createSignal<Set<string>>(new Set());
  const [collapsedFolders, setCollapsedFolders] = createSignal<Set<string>>(new Set());
  const [environmentName, setEnvironmentName] = createSignal("Local");
  const [savedEnvironments, setSavedEnvironments] = createSignal<Environment[]>([]);
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

  const activeSavedRequest = createMemo(() => {
    for (const collection of collections()) {
      const saved = collection.requests.find((request) => request.id === activeRequestId());
      if (saved) return { collection, saved };
    }
    return undefined;
  });

  const inheritedVariables = createMemo<EnvironmentVariable[]>(() => {
    const active = activeSavedRequest();
    if (!active) return environment();
    const folder = active.saved.folder_id
      ? active.collection.folders.find((item) => item.id === active.saved.folder_id)
      : undefined;
    const merged = new Map<string, EnvironmentVariable>();
    for (const variable of [
      ...metadataVariables(active.collection.metadata),
      ...metadataVariables(folder?.metadata),
      ...metadataVariables(active.saved.request.metadata),
      ...environment(),
    ]) {
      if (!variable.enabled || !variable.key.trim()) continue;
      merged.set(variable.key, variable);
    }
    return [...merged.values()];
  });
  const executableRequest = createMemo<ApiRequest>(() => {
    const active = activeSavedRequest();
    const request = currentRequest();
    if (!active) return request;
    const folder = active.saved.folder_id
      ? active.collection.folders.find((item) => item.id === active.saved.folder_id)
      : undefined;
    const collectionScripts = {
      pre_request: active.collection.metadata?.pre_request_script,
      post_request: active.collection.metadata?.post_request_script,
    };
    const folderScripts = {
      pre_request: folder?.metadata?.pre_request_script,
      post_request: folder?.metadata?.post_request_script,
    };
    const scripts = mergeScripts(collectionScripts, folderScripts, request.scripts);
    const inheritedMetadata = {
      ...(active.collection.metadata ?? {}),
      ...(folder?.metadata ?? {}),
      ...(request.metadata ?? {}),
    };
    return { ...request, metadata: inheritedMetadata, scripts };
  });

  const commandActions = createMemo<CommandAction[]>(() => [
    { label: "Send", shortcut: "Ctrl+Enter", run: onSend },
    { label: "New Request", shortcut: "Ctrl+N", run: () => newRequest() },
    { label: "Save Collection", shortcut: "Ctrl+S", run: onSaveActiveCollection },
    { label: "Load Collections", shortcut: "", run: () => onLoadCollections() },
    { label: "Load History", shortcut: "", run: () => onLoadHistory() },
    { label: "Clear History", shortcut: "", run: onClearHistory },
  ]);

  const appMenuGroups = createMemo<AppMenuGroup[]>(() => [
    {
      label: "File",
      items: [
        { label: "New Request", shortcut: "Ctrl+N", run: () => newRequest() },
        { label: "New Collection", run: () => newCollection() },
        { label: "Import", run: () => setSideView("Imports") },
        { label: "Save", shortcut: "Ctrl+S", run: onSaveActiveCollection },
        { label: "Load", run: () => onLoadCollections() },
        { label: "Export JSON", run: () => onExport("json") },
        { label: "Export YAML", run: () => onExport("yaml") },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Rename Request", run: renameActiveRequest },
        { label: "Duplicate Request", run: duplicateActiveRequest },
        { label: "Delete Request", run: deleteActiveRequest },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Collections", run: () => setSideView("Collections") },
        { label: "History", run: () => setSideView("History") },
        { label: "Environments", run: () => setSideView("Environments") },
        { label: "Imports", run: () => setSideView("Imports") },
        { label: sidebarVisible() ? "Hide Sidebar" : "Show Sidebar", run: () => setSidebarVisible((v) => !v) },
        { label: inspectorVisible() ? "Hide Inspector" : "Show Inspector", run: () => setInspectorVisible((v) => !v) },
        {
          label: responsePlacement() === "bottom" ? "Response Right" : "Response Bottom",
          run: () => setResponsePlacement((p) => (p === "bottom" ? "right" : "bottom")),
        },
        {
          label: "Reset Layout",
          run: () => {
            setSidebarVisible(true);
            setInspectorVisible(true);
            setResponsePlacement("bottom");
            setSidebarWidth(252);
            setResponsePercent(57);
            setMessage("Reset layout.");
          },
        },
      ],
    },
    {
      label: "Request",
      items: [
        { label: "Send", shortcut: "Ctrl+Enter", disabled: loading(), run: onSend },
        { label: "Rename", run: renameActiveRequest },
        { label: "Duplicate", run: duplicateActiveRequest },
        { label: "Delete", run: deleteActiveRequest },
      ],
    },
    {
      label: "Workspace",
      items: [
        { label: "Init Workspace", run: onInitWorkspace },
        { label: "Open Workspace", run: onOpenWorkspace },
        { label: "Load Collections", run: () => onLoadCollections() },
        { label: "Save Collection", run: onSaveActiveCollection },
        { label: "Load Environments", run: onLoadEnvironments },
        { label: "Save Environment", run: onSaveEnvironment },
        { label: "Load History", run: () => onLoadHistory() },
        { label: "Clear History", run: onClearHistory },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Command Palette", shortcut: "Ctrl+K", run: () => setCommandPaletteOpen(true) },
        { label: "About Velofire", run: () => setAboutOpen(true) },
      ],
    },
  ]);

  let lastNotifiedMessage = "";
  createEffect(() => {
    const currentMessage = message();
    if (currentMessage && currentMessage !== lastNotifiedMessage) {
      lastNotifiedMessage = currentMessage;
      notifyMessage(currentMessage);
      setConsoleLogs((items) => [
        {
          id: id("log"),
          level: logLevelForMessage(currentMessage),
          message: currentMessage,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...items.slice(0, 199),
      ]);
    }
  });

  function appendConsoleLog(level: ConsoleLogLevel, message: string, detail?: string, meta: Partial<ConsoleLogItem> = {}) {
    setConsoleLogs((items) => [
      {
        id: id("log"),
        level,
        message,
        detail,
        timestamp: new Date().toLocaleTimeString(),
        ...meta,
      },
      ...items.slice(0, 199),
    ]);
  }

  async function copyLogDetail(item: ConsoleLogItem) {
    const content = item.detail ?? "";
    if (!content) {
      setMessage("Copy failed: no log detail available.");
      return;
    }
    const estimatedRamMb = Math.max(0.01, (content.length * 2) / 1024 / 1024);
    if (content.length > 100_000) {
      const confirmed = await askConfirm(
        "Copy Large Network Log",
        `This will copy about ${Math.ceil(content.length / 1024)} KB of text. Estimated temporary RAM usage is ${estimatedRamMb.toFixed(2)} MB. Continue?`,
        "Copy",
      );
      if (!confirmed) return;
    }
    try {
      await navigator.clipboard.writeText(content);
      setMessage(`Copied log details. Estimated temporary RAM usage ${estimatedRamMb.toFixed(2)} MB.`);
    } catch (err) {
      setMessage(`Copy failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  onMount(() => {
    void onLoadHistory(workspacePath(), false);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && contextMenu()) {
        event.preventDefault();
        setContextMenu(null);
        return;
      }
      if (event.key === "Escape" && commandPaletteOpen()) {
        event.preventDefault();
        setCommandPaletteOpen(false);
        return;
      }
      if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "enter") {
        event.preventDefault();
        void onSend();
      } else if (key === "s") {
        event.preventDefault();
        void onSaveActiveCollection();
      } else if (key === "n") {
        event.preventDefault();
        newRequest();
      } else if (key === "k") {
        event.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    };

    const onPointerDown = () => setContextMenu(null);
    const onResize = () => setContextMenu(null);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onResize);
    onCleanup(() => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onResize);
    });
  });

  function openContextMenu(event: MouseEvent, title: string, items: ContextMenuItem[]) {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 188;
    const menuHeight = Math.min(320, 34 + items.length * 30);
    setContextMenu({
      x: Math.min(event.clientX, Math.max(8, window.innerWidth - menuWidth - 8)),
      y: Math.min(event.clientY, Math.max(8, window.innerHeight - menuHeight - 8)),
      title,
      items,
    });
  }

  function runContextMenuItem(item: ContextMenuItem) {
    if (item.disabled) return;
    setContextMenu(null);
    void item.run();
  }

  function askText(title: string, label: string, value: string, confirmLabel = "Save"): Promise<string | null> {
    return new Promise((resolve) => {
      setDialog({ type: "input", title, label, value, confirmLabel, resolve });
    });
  }

  function askConfirm(title: string, description: string, confirmLabel = "Confirm", danger = false): Promise<boolean> {
    return new Promise((resolve) => {
      setDialog({ type: "confirm", title, description, confirmLabel, danger, resolve });
    });
  }

  function closeDialog(value: string | boolean | null) {
    const current = dialog();
    setDialog(null);
    if (!current) return;
    if (current.type === "input") {
      current.resolve(typeof value === "string" ? value.trim() || null : null);
      return;
    }
    current.resolve(value === true);
  }

  function toggleCollection(collectionId: string) {
    setCollapsedCollections((current) => {
      const next = new Set(current);
      if (next.has(collectionId)) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
  }

  function toggleFolder(folderId: string) {
    setCollapsedFolders((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function startSidebarResize(event: MouseEvent) {
    if (!sidebarVisible()) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth();
    const onMove = (moveEvent: MouseEvent) => {
      const width = startWidth + moveEvent.clientX - startX;
      setSidebarWidth(Math.min(maxSidebarWidth, Math.max(minSidebarWidth, width)));
    };
    const onUp = () => {
      document.body.classList.remove("is-resizing");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    document.body.classList.add("is-resizing");
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function startResponseResize(event: MouseEvent) {
    event.preventDefault();
    const startPercent = responsePercent();
    const startPosition = responsePlacement() === "right" ? event.clientX : event.clientY;
    const panelSize = Math.max(1, responsePlacement() === "right" ? window.innerWidth : window.innerHeight - 76);
    const onMove = (moveEvent: MouseEvent) => {
      const nextPosition = responsePlacement() === "right" ? moveEvent.clientX : moveEvent.clientY;
      const delta = ((startPosition - nextPosition) / panelSize) * 100;
      setResponsePercent(Math.min(maxResponsePercent, Math.max(minResponsePercent, startPercent + delta)));
    };
    const onUp = () => {
      document.body.classList.remove("is-resizing");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    document.body.classList.add("is-resizing");
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

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

  function selectRequest(requestId: string) {
    setActiveRequestId(requestId);
    setResourceSelection({ type: "request", requestId });
  }

  function updateCollectionMetadata(collectionId: string, metadata: Record<string, string>) {
    setCollections((items) => items.map((item) => (item.id === collectionId ? { ...item, metadata } : item)));
  }

  function updateFolderMetadata(collectionId: string, folderId: string, metadata: Record<string, string>) {
    setCollections((items) =>
      items.map((item) =>
        item.id === collectionId
          ? {
              ...item,
              folders: item.folders.map((folder) => (folder.id === folderId ? { ...folder, metadata } : folder)),
            }
          : item,
      ),
    );
  }

  async function newCollection() {
    const collection = defaultCollection();
    const name = await askText("New Collection", "Collection name", `Collection ${collections().length + 1}`, "Create");
    if (!name) return;
    collection.name = name;
    collection.requests = collection.requests.map((saved) => ({
      ...saved,
      request: { ...saved.request, path: [name] },
    }));
    setCollections((items) => [...items, collection]);
    setActiveRequestId(collection.requests[0].id);
    setMessage(`Created collection ${name}.`);
  }

  async function newFolder(collectionId = collections()[0]?.id) {
    const collection = collections().find((item) => item.id === collectionId);
    if (!collection) return;
    const name = await askText("New Folder", "Folder name", `Folder ${collection.folders.length + 1}`, "Create");
    if (!name) return;
    const folder: CollectionFolder = { id: id("folder"), name, sort_order: collection.folders.length, metadata: {} };
    setCollections((items) =>
      items.map((item) => item.id === collectionId ? { ...item, folders: [...item.folders, folder] } : item),
    );
    setMessage(`Created folder ${folder.name}.`);
  }

  async function renameCollection(collectionId: string) {
    const collection = collections().find((item) => item.id === collectionId);
    if (!collection) return;
    const name = await askText("Rename Collection", "Collection name", collection.name);
    if (!name || name === collection.name) return;
    setCollections((items) => items.map((item) => (item.id === collectionId ? { ...item, name } : item)));
    setMessage(`Renamed collection to ${name}.`);
  }

  async function deleteCollection(collectionId: string) {
    const collection = collections().find((item) => item.id === collectionId);
    if (!collection) return;
    if (collections().length <= 1) { setMessage("Delete blocked: keep at least one collection."); return; }
    const confirmed = await askConfirm("Delete Collection", `Delete collection "${collection.name}"?`, "Delete", true);
    if (!confirmed) return;
    const nextCollections = collections().filter((item) => item.id !== collectionId);
    setCollections(nextCollections);
    if (collection.requests.some((r) => r.id === activeRequestId())) {
      setActiveRequestId(nextCollections[0]?.requests[0]?.id ?? "");
      setResponse(null);
    }
  }

  async function renameFolder(collectionId: string, folderId: string) {
    const collection = collections().find((item) => item.id === collectionId);
    const folder = collection?.folders.find((item) => item.id === folderId);
    if (!collection || !folder) return;
    const name = await askText("Rename Folder", "Folder name", folder.name);
    if (!name || name === folder.name) return;
    setCollections((items) =>
      items.map((item) =>
        item.id === collectionId
          ? {
              ...item,
              folders: item.folders.map((c) => c.id === folderId ? { ...c, name } : c),
              requests: item.requests.map((s) =>
                s.folder_id === folderId ? { ...s, request: { ...s.request, path: [item.name, name] } } : s,
              ),
            }
          : item,
      ),
    );
    setMessage(`Renamed folder to ${name}.`);
  }

  async function deleteFolder(collectionId: string, folderId: string) {
    const collection = collections().find((item) => item.id === collectionId);
    const folder = collection?.folders.find((item) => item.id === folderId);
    if (!collection || !folder) return;
    const confirmed = await askConfirm("Delete Folder", `Delete folder "${folder.name}"? Requests move to collection root.`, "Delete", true);
    if (!confirmed) return;
    setCollections((items) =>
      items.map((item) =>
        item.id === collectionId
          ? {
              ...item,
              folders: item.folders.filter((c) => c.id !== folderId),
              requests: item.requests.map((s) =>
                s.folder_id === folderId ? { ...s, folder_id: undefined, request: { ...s.request, path: [item.name] } } : s,
              ),
            }
          : item,
      ),
    );
    setMessage(`Deleted folder ${folder.name}; requests moved to root.`);
  }

  function newRequest(collectionId = collections()[0]?.id, folderId?: string) {
    const collection = collections().find((item) => item.id === collectionId);
    if (!collection) return;
    const folder = folderId ? collection.folders.find((item) => item.id === folderId) : undefined;
    const request = defaultRequest(`Request ${collection.requests.length + 1}`);
    if (folder) request.path = [collection.name, folder.name];
    else request.path = [collection.name];
    const saved = savedRequest(request, collectionId, folderId);
    setCollections((items) =>
      items.map((c) => c.id === collectionId ? { ...c, requests: [...c.requests, saved] } : c),
    );
    setActiveRequestId(saved.id);
    setMessage(folder ? `Created request in ${folder.name}.` : `Created request in ${collection.name}.`);
  }

  async function renameActiveRequest() {
    const active = activeSavedRequest();
    if (!active) { setMessage("Rename failed: no active request is selected."); return; }
    const nextName = await askText("Rename Request", "Request name", active.saved.name);
    if (!nextName || nextName === active.saved.name) return;
    setCollections((items) =>
      items.map((collection) => ({
        ...collection,
        requests: collection.requests.map((s) =>
          s.id === active.saved.id ? { ...s, name: nextName, request: { ...s.request, name: nextName } } : s,
        ),
      })),
    );
    setMessage(`Renamed request to ${nextName}.`);
  }

  function renameRequest(requestId: string) { setActiveRequestId(requestId); void renameActiveRequest(); }

  function duplicateActiveRequest() {
    const active = activeSavedRequest();
    if (!active) { setMessage("Duplicate failed: no active request is selected."); return; }
    const nextId = id("request");
    const nextName = `${active.saved.name} Copy`;
    const copy: SavedRequest = { ...active.saved, id: nextId, name: nextName, request: { ...active.saved.request, id: nextId, name: nextName } };
    setCollections((items) =>
      items.map((c) => c.id === active.collection.id ? { ...c, requests: [...c.requests, copy] } : c),
    );
    setActiveRequestId(copy.id);
    setMessage(`Duplicated ${active.saved.name}.`);
  }

  function duplicateRequest(requestId: string) { setActiveRequestId(requestId); duplicateActiveRequest(); }

  async function deleteActiveRequest() {
    const active = activeSavedRequest();
    if (!active) { setMessage("Delete failed: no active request is selected."); return; }
    if (active.collection.requests.length <= 1 && collections().length <= 1) { setMessage("Delete blocked: keep at least one request in the workspace."); return; }
    const confirmed = await askConfirm("Delete Request", `Delete "${active.saved.name}"? This only removes it from the current collection view until saved.`, "Delete", true);
    if (!confirmed) return;
    const nextCollections = collections()
      .map((c) => c.id === active.collection.id ? { ...c, requests: c.requests.filter((s) => s.id !== active.saved.id) } : c)
      .filter((c) => c.requests.length > 0 || c.folders.length > 0);
    const finalCollections = nextCollections.length > 0 ? nextCollections : [defaultCollection()];
    setCollections(finalCollections);
    setActiveRequestId(finalCollections.flatMap((c) => c.requests)[0]?.id ?? "");
    setResponse(null);
    setMessage(`Deleted ${active.saved.name}. Save the collection to persist this change.`);
  }

  function deleteRequest(requestId: string) { setActiveRequestId(requestId); void deleteActiveRequest(); }

  function moveRequest(
    requestId: string,
    targetCollectionId: string,
    folderId?: string,
    targetRequestId?: string,
    position: "before" | "after" = "after",
  ) {
    const sourceCollection = collections().find((c) => c.requests.some((s) => s.id === requestId));
    const targetCollection = collections().find((c) => c.id === targetCollectionId);
    const sourceRequest = sourceCollection?.requests.find((s) => s.id === requestId);
    if (!sourceCollection || !targetCollection || !sourceRequest) return;
    if (targetRequestId === requestId) return;

    const targetFolder = folderId ? targetCollection.folders.find((f) => f.id === folderId) : undefined;
    if (folderId && !targetFolder) return;

    const movedRequest: SavedRequest = {
      ...sourceRequest,
      collection_id: targetCollection.id,
      folder_id: targetFolder?.id,
      request: {
        ...sourceRequest.request,
        path: targetFolder ? [targetCollection.name, targetFolder.name] : [targetCollection.name],
      },
    };

    const insertRequest = (requests: SavedRequest[]) => {
      const withoutMoved = requests.filter((saved) => saved.id !== requestId);
      if (!targetRequestId) return [...withoutMoved, movedRequest];

      const targetIndex = withoutMoved.findIndex((saved) => saved.id === targetRequestId);
      if (targetIndex < 0) return [...withoutMoved, movedRequest];

      const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
      return [
        ...withoutMoved.slice(0, insertIndex),
        movedRequest,
        ...withoutMoved.slice(insertIndex),
      ];
    };

    setCollections((items) =>
      items.map((collection) => {
        if (collection.id === sourceCollection.id && collection.id === targetCollection.id) {
          return {
            ...collection,
            requests: insertRequest(collection.requests),
          };
        }
        if (collection.id === sourceCollection.id) {
          return { ...collection, requests: collection.requests.filter((saved) => saved.id !== requestId) };
        }
        if (collection.id === targetCollection.id) {
          return { ...collection, requests: insertRequest(collection.requests) };
        }
        return collection;
      }),
    );
    setActiveRequestId(requestId);
    const sameParent = sourceCollection.id === targetCollection.id && sourceRequest.folder_id === targetFolder?.id;
    setMessage(
      sameParent
        ? `Reordered request in ${targetFolder ? `${targetCollection.name} / ${targetFolder.name}` : `${targetCollection.name} root`}.`
        : targetFolder
          ? `Moved request to ${targetCollection.name} / ${targetFolder.name}.`
          : `Moved request to ${targetCollection.name} root.`,
    );
  }

  function moveRequestToRoot(requestId: string) {
    const collection = collections().find((item) => item.requests.some((request) => request.id === requestId));
    if (collection) moveRequest(requestId, collection.id, undefined);
  }

  function requestContextItems(saved: SavedRequest): ContextMenuItem[] {
    return [
      { label: "Open settings", run: () => { selectRequest(saved.id); setResourceSelection({ type: "request", requestId: saved.id }); } },
      { label: "Rename", run: () => renameRequest(saved.id) },
      { label: "Duplicate", run: () => duplicateRequest(saved.id) },
      { label: "Move to root", disabled: !saved.folder_id, run: () => moveRequestToRoot(saved.id) },
      { label: "Copy URL", run: () => copyRequestUrl(saved.request.url) },
      { label: "Delete", danger: true, run: () => deleteRequest(saved.id) },
    ];
  }

  function collectionContextItems(collection: Collection): ContextMenuItem[] {
    return [
      { label: "Open overview", run: () => setResourceSelection({ type: "collection", collectionId: collection.id }) },
      { label: "New request", run: () => newRequest(collection.id) },
      { label: "New folder", run: () => newFolder(collection.id) },
      { label: "Rename", run: () => renameCollection(collection.id) },
      { label: "Delete", danger: true, run: () => deleteCollection(collection.id) },
    ];
  }

  function folderContextItems(collection: Collection, folder: CollectionFolder): ContextMenuItem[] {
    return [
      { label: "Open overview", run: () => setResourceSelection({ type: "folder", collectionId: collection.id, folderId: folder.id }) },
      { label: "New request", run: () => newRequest(collection.id, folder.id) },
      { label: "Rename", run: () => renameFolder(collection.id, folder.id) },
      { label: "Delete", danger: true, run: () => deleteFolder(collection.id, folder.id) },
    ];
  }

  function historyContextItems(item: RequestHistoryItem): ContextMenuItem[] {
    return [
      { label: "Replay", run: () => replayHistoryItem(item) },
      { label: "Copy URL", run: () => copyRequestUrl(item.request.url) },
      { label: "Clear history", danger: true, run: onClearHistory },
    ];
  }

  function responseContextItems(): ContextMenuItem[] {
    return [
      { label: "Copy final URL", disabled: !response()?.final_url, run: () => copyRequestUrl(response()?.final_url ?? "") },
      { label: "Clear response", danger: true, disabled: !response(), run: clearResponse },
    ];
  }

  async function copyRequestUrl(url: string) {
    if (!url) { setMessage("Copy failed: no URL available."); return; }
    try { await navigator.clipboard?.writeText(url); setMessage("Copied URL."); }
    catch (err) { setMessage(`Copy failed: ${err instanceof Error ? err.message : String(err)}`); }
  }

  function clearResponse() { setResponse(null); setMessage("Cleared response."); }

  async function onSend() {
    setLoading(true); setMessage(null);
    try {
      const request = executableRequest();
      const activeEnvironment: Environment = { id: environmentId(environmentName()), name: environmentName().trim() || "Local", variables: inheritedVariables() };
      const usesNodeScripts = request.metadata?.script_runtime === "node" && Boolean(request.scripts?.pre_request || request.scripts?.post_request);
      if (usesNodeScripts) {
        const confirmed = await askConfirm(
          "Enable Node.js Scripts",
          "This request will run local Node.js script code with access to Node modules such as crypto. Only continue for collections you trust.",
          "Run Script",
        );
        if (!confirmed) return;
      }
      const result = await executeRequest({
        request,
        environment: activeEnvironment,
        root_path: workspacePath(),
        save_history: true,
        allow_node_scripts: usesNodeScripts,
      });
      setResponse(result.response);
      appendConsoleLog(
        "network",
        networkLogMessage(result.request, result.response),
        formatNetworkExchange(result.request, result.response),
        {
          status: result.response.status,
          durationMs: result.response.duration_ms,
          sizeBytes: result.response.body_bytes_len,
        },
      );
      const environmentUpdates = Object.entries(result.environment_updates ?? {});
      if (environmentUpdates.length > 0) {
        setEnvironment((items) => {
          const next = [...items];
          for (const [key, value] of environmentUpdates) {
            const existingIndex = next.findIndex((variable) => variable.key === key);
            if (existingIndex >= 0) {
              next[existingIndex] = { ...next[existingIndex], value, enabled: true };
            } else {
              next.push({ key, value, is_secret: false, enabled: true });
            }
          }
          return next;
        });
        appendConsoleLog("info", `Updated runtime variable(s): ${environmentUpdates.map(([key]) => key).join(", ")}`);
      }
      if (result.script_log.length > 0) setMessage(result.script_log.join("\n"));
      setHistory((items) => [
        { id: result.history?.id ?? id("history"), name: request.name ?? request.url, request: result.request, response: result.response, status: result.response.status, duration_ms: result.response.duration_ms, created_at: result.history?.created_at ?? new Date().toLocaleTimeString() },
        ...items.slice(0, 49),
      ]);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      appendConsoleLog("error", `Request failed: ${error}`);
      setMessage(error);
    }
    finally { setLoading(false); }
  }

  function rememberWorkspacePath(path = workspacePath()): string {
    const normalized = normalizedWorkspacePath(path);
    localStorage.setItem(workspaceStorageKey, normalized);
    setWorkspacePath(normalized);
    setRecentWorkspaces((paths) => {
      const next = mergeRecentWorkspacePaths(normalized, paths);
      localStorage.setItem(recentWorkspacesStorageKey, JSON.stringify(next));
      return next;
    });
    return normalized;
  }

  async function onOpenWorkspace() {
    const selected = await pickFolder();
    if (!selected) return;
    await onLoadCollections(selected);
    await onLoadEnvironments();
  }

  async function onLoadCollections(path = workspacePath()) {
    const rootPath = rememberWorkspacePath(path);
    try {
      const loaded = await loadCollections(rootPath);
      if (loaded.length > 0) { setCollections(loaded); setActiveRequestId(loaded[0].requests[0]?.id ?? ""); setMessage(`Loaded ${loaded.length} collection(s) from ${rootPath}.`); }
      else setMessage(`No collections found in ${rootPath}. Save the active collection to create one.`);
      await onLoadHistory(rootPath, false);
    } catch (err) { setMessage(`Load failed: ${err instanceof Error ? err.message : String(err)}`); }
  }

  async function onInitWorkspace() {
    const rootPath = rememberWorkspacePath();
    const name = await askText("Initialize Workspace", "Workspace name", "Velofire Workspace", "Initialize");
    if (!name) return;
    try {
      const workspace = await initWorkspace(rootPath, name);
      setMessage(`Initialized workspace ${workspace.name} at ${workspace.root_path}.`);
      await onLoadCollections(rootPath);
      await onLoadEnvironments();
    } catch (err) { setMessage(`Workspace init failed: ${err instanceof Error ? err.message : String(err)}`); }
  }

  async function onSaveActiveCollection() {
    const collection = collections().find((item) => item.requests.some((r) => r.id === activeRequestId()));
    if (!collection) return;
    const rootPath = rememberWorkspacePath();
    try { const path = await saveCollection(rootPath, collection); setMessage(`Saved ${collection.name} to ${path}.`); }
    catch (err) { setMessage(`Save failed: ${err instanceof Error ? err.message : String(err)}`); }
  }

  function currentEnvironment(): Environment {
    return { id: environmentId(environmentName()), name: environmentName().trim() || "Local", variables: environment() };
  }

  function applyEnvironment(next: Environment) { setEnvironmentName(next.name); setEnvironment(next.variables); }

  async function onLoadEnvironments() {
    const rootPath = rememberWorkspacePath();
    try {
      const loaded = await loadEnvironments(rootPath);
      setSavedEnvironments(loaded);
      if (loaded.length > 0) { applyEnvironment(loaded.find((item) => item.name === environmentName()) ?? loaded[0]); setMessage(`Loaded ${loaded.length} environment(s) from ${rootPath}.`); }
      else setMessage(`No environments found in ${rootPath}.`);
    } catch (err) { setMessage(`Environment load failed: ${err instanceof Error ? err.message : String(err)}`); }
  }

  async function onSaveEnvironment() {
    const rootPath = rememberWorkspacePath();
    const activeEnvironment = currentEnvironment();
    try {
      const path = await saveEnvironment(rootPath, activeEnvironment);
      setSavedEnvironments((items) => [activeEnvironment, ...items.filter((item) => item.id !== activeEnvironment.id)].sort((a, b) => a.name.localeCompare(b.name)));
      setMessage(`Saved ${activeEnvironment.name} to ${path} with secrets redacted.`);
    } catch (err) { setMessage(`Environment save failed: ${err instanceof Error ? err.message : String(err)}`); }
  }

  async function onLoadHistory(path = workspacePath(), showMessage = true) {
    const rootPath = rememberWorkspacePath(path);
    try {
      const loaded = await loadHistory(rootPath);
      setHistory(loaded.map(historyItemFromEntry).slice(0, 50));
      if (showMessage) setMessage(`Loaded ${loaded.length} history item(s) from ${rootPath}.`);
    } catch (err) { setMessage(`History load failed: ${err instanceof Error ? err.message : String(err)}`); }
  }

  async function onClearHistory() {
    const rootPath = rememberWorkspacePath();
    try { await clearHistory(rootPath); setHistory([]); setMessage(`Cleared request history in ${rootPath}.`); }
    catch (err) { setMessage(`History clear failed: ${err instanceof Error ? err.message : String(err)}`); }
  }

  function replayHistoryItem(item: RequestHistoryItem) {
    const requestId = activeRequestId();
    setCollections((items) =>
      items.map((c) => ({ ...c, requests: c.requests.map((s) => s.id === requestId ? { ...s, name: item.request.name ?? item.name, request: { ...item.request, id: s.id } } : s) })),
    );
    setResponse(item.response ?? null);
    setMessage(`Loaded ${item.name} from history.`);
  }

  function activeCollection(): Collection | undefined {
    return collections().find((item) => item.requests.some((r) => r.id === activeRequestId()));
  }

  function downloadText(filename: string, text: string) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
  }

  async function onExport(format: "json" | "yaml") {
    const collection = activeCollection();
    if (!collection) { setMessage("Export failed: no active collection is selected."); return; }
    try {
      const content = format === "json" ? await exportCollectionJson(collection) : await exportCollectionYaml(collection);
      downloadText(`${collection.name}.${format === "json" ? "json" : "yaml"}`, content);
      setMessage(`Exported ${collection.name} as ${format.toUpperCase()} with secrets redacted.`);
    } catch (err) { setMessage(`Export failed: ${err instanceof Error ? err.message : String(err)}`); }
  }

  async function onImportCurl() {
    const content = importText().trim();
    if (!content) { setMessage("Import failed: paste a cURL command first."); return; }
    if (!content.toLowerCase().startsWith("curl")) { setMessage("Import warning: this does not look like cURL. Use Postman or OpenAPI import for JSON/YAML documents."); return; }
    try {
      const request = await importCurl(content);
      setLastImportReport(null);
      const collectionId = id("collection");
      const collection: Collection = { id: collectionId, name: "Imported cURL", folders: [], requests: [savedRequest(request, collectionId)] };
      setCollections((items) => [...items, collection]);
      setActiveRequestId(collection.requests[0].id);
      setSideView("Collections");
      setMessage(`Imported cURL request: ${request.name ?? request.url}. Save the collection to persist it.`);
    } catch (err) { setMessage(`cURL import failed: ${err instanceof Error ? err.message : String(err)}`); }
  }

  async function onImportCollection(format: "postman" | "openapi") {
    const content = importText().trim();
    if (!content) { setMessage(`Import failed: paste ${format === "postman" ? "Postman JSON" : "OpenAPI JSON/YAML"} first.`); return; }
    if (format === "postman" && !content.includes('"item"')) { setMessage("Import warning: this does not look like a Postman collection. Expected JSON with an item list."); return; }
    if (format === "openapi" && !/(openapi|swagger)\s*[:"]/i.test(content)) { setMessage("Import warning: this does not look like an OpenAPI document. Expected an openapi or swagger field."); return; }
    try {
      const report = format === "postman" ? await importPostmanCollection(content) : await importOpenApi(content);
      const collection = report.collection;
      setLastImportReport(report);
      setCollections((items) => [...items, collection]);
      setActiveRequestId(collection.requests[0]?.id ?? activeRequestId());
      setSideView("Collections");
      setMessage(collection.requests.length > 0
        ? `Imported ${collection.name} with ${report.imported_request_count} request(s), ${report.warnings.length} warning(s), ${report.unsupported.length} unsupported item(s).`
        : `Imported ${collection.name}, but it did not contain any requests.`);
    } catch (err) { setMessage(`${format === "postman" ? "Postman" : "OpenAPI"} import failed: ${err instanceof Error ? err.message : String(err)}`); }
  }

  return (
    <div class="app-shell">
      <div class="toast-root">
        <Toaster theme="dark" position="bottom-right" richColors={false} closeButton visibleToasts={4}
          toastOptions={{ class: "velofire-toast", classes: { toast: "velofire-toast", title: "velofire-toast-title", description: "velofire-toast-description", closeButton: "velofire-toast-close" } }} />
      </div>

      <CommandPalette open={commandPaletteOpen()} onClose={() => setCommandPaletteOpen(false)} actions={commandActions()} />
      <AboutDialog open={aboutOpen()} onClose={() => setAboutOpen(false)} />
      <GenericDialog state={dialog()} onClose={closeDialog} />
      <AppContextMenu state={contextMenu()} onRunItem={runContextMenuItem} />
      <ConsoleDrawer
        open={consoleOpen()}
        logs={consoleLogs()}
        onToggle={() => setConsoleOpen((open) => !open)}
        onClear={() => setConsoleLogs([])}
        onCopyLogDetail={copyLogDetail}
      />

      <Topbar appMenuGroups={appMenuGroups()} />

      <main class="workspace" style={{ "grid-template-columns": sidebarVisible() ? `${sidebarWidth()}px 6px minmax(0, 1fr)` : "minmax(0, 1fr)" }}>
        <Show when={sidebarVisible()}>
          <Sidebar
            sideView={sideView()} collections={collections()} activeRequestId={activeRequestId()}
            collapsedCollections={collapsedCollections()} collapsedFolders={collapsedFolders()}
            history={history()} environmentName={environmentName()} environment={environment()}
            savedEnvironments={savedEnvironments()} importText={importText()} lastImportReport={lastImportReport()}
            onToggleCollection={toggleCollection} onToggleFolder={toggleFolder} onSetActiveRequest={selectRequest}
            onNewCollection={() => newCollection()} onNewRequest={(cid, fid) => newRequest(cid, fid)}
            onContextMenu={openContextMenu} requestContextItems={requestContextItems}
            collectionContextItems={collectionContextItems} folderContextItems={folderContextItems}
            historyContextItems={historyContextItems} onLoadHistory={() => onLoadHistory()}
            onClearHistory={onClearHistory} onReplayHistoryItem={replayHistoryItem}
            onLoadEnvironments={onLoadEnvironments} onSaveEnvironment={onSaveEnvironment}
            onSetEnvironmentName={setEnvironmentName} onSetEnvironment={setEnvironment}
            onApplyEnvironment={applyEnvironment} onSetImportText={setImportText}
            onImportCurl={onImportCurl} onImportCollection={onImportCollection}
            onMoveRequest={moveRequest}
          />
        </Show>
        <Show when={sidebarVisible()}>
          <button class="splitter vertical" type="button" aria-label="Resize sidebar" onMouseDown={startSidebarResize} />
        </Show>

        <MainPanel
          currentRequest={currentRequest()}
          responsePlacement={responsePlacement()} responsePercent={responsePercent()}
          response={response()} message={message()} loading={loading()}
          environmentName={environmentName()} environmentVariables={inheritedVariables()}
          resourceSelection={resourceSelection()} collections={collections()}
          onSelectRequest={selectRequest}
          onUpdateCollectionMetadata={updateCollectionMetadata}
          onUpdateFolderMetadata={updateFolderMetadata}
          onSend={onSend} onUpdateRequest={updateRequest}
          onStartResponseResize={startResponseResize}
        />
      </main>
    </div>
  );
}

render(() => <App />, document.getElementById("root")!);
