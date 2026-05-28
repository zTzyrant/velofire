import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { loadCollections, saveCollection } from "../../services/commands";
import type { ApiRequest, Collection, CollectionFolder, SavedRequest } from "../../types";

interface CollectionsSidebarProps {
  currentRequest: ApiRequest;
  selectedRequestId?: string;
  onSelectRequest: (request: ApiRequest, savedRequestId: string) => void;
  onCreateRequest: (request: ApiRequest, savedRequestId: string) => void;
}

function stableId(prefix: string, value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const char of value) {
    hash ^= BigInt(char.charCodeAt(0));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `${prefix}-${hash.toString(16).padStart(16, "0")}`;
}

function requestName(request: ApiRequest): string {
  return request.name?.trim() || "Untitled request";
}

function cloneRequest(request: ApiRequest, name = requestName(request)): ApiRequest {
  return {
    ...request,
    id: request.id ?? stableId("request", `${name}:${request.url}`),
    name,
    query_params: request.query_params.map((param) => ({ ...param })),
    headers: request.headers.map((header) => ({ ...header })),
    metadata: { ...request.metadata },
    path: [...request.path],
  };
}

function makeSavedRequest(request: ApiRequest, collectionId: string, folderId?: string): SavedRequest {
  const name = requestName(request);
  const nextRequest = cloneRequest(request, name);
  return {
    id: nextRequest.id ?? stableId("request", `${collectionId}:${folderId ?? "root"}:${name}`),
    collection_id: collectionId,
    folder_id: folderId,
    name,
    request: nextRequest,
  };
}

function defaultCollection(request: ApiRequest): Collection {
  const collectionId = "collection-preview";
  const folderId = "folder-users";
  return {
    id: collectionId,
    name: "Default",
    folders: [{ id: folderId, name: "Users", sort_order: 0 }],
    requests: [{ ...makeSavedRequest(request, collectionId, folderId), id: request.id ?? "request-preview" }],
  };
}

function methodClass(method: ApiRequest["method"]): string {
  return method === "Delete" ? "del" : method.toLowerCase();
}

function methodLabel(method: ApiRequest["method"]): string {
  return method.toUpperCase();
}

export function CollectionsSidebar(props: CollectionsSidebarProps) {
  const [workspaceRoot, setWorkspaceRoot] = createSignal(
    localStorage.getItem("velofire.workspaceRoot") ?? ".",
  );
  const [collections, setCollections] = createSignal<Collection[]>([defaultCollection(props.currentRequest)]);
  const [activeCollectionId, setActiveCollectionId] = createSignal("collection-preview");
  const [activeFolderId, setActiveFolderId] = createSignal<string | undefined>("folder-users");
  const [status, setStatus] = createSignal("Ready");

  const activeCollection = createMemo(
    () => collections().find((collection) => collection.id === activeCollectionId()) ?? collections()[0],
  );

  createEffect(() => {
    const selectedRequestId = props.selectedRequestId;
    if (!selectedRequestId) {
      return;
    }

    setCollections((items) =>
      items.map((collection) => ({
        ...collection,
        requests: collection.requests.map((saved) =>
          saved.id === selectedRequestId
            ? { ...saved, name: requestName(props.currentRequest), request: cloneRequest(props.currentRequest) }
            : saved,
        ),
      })),
    );
  });

  async function onLoad() {
    const rootPath = workspaceRoot().trim() || ".";
    localStorage.setItem("velofire.workspaceRoot", rootPath);
    setStatus("Loading");
    try {
      const loaded = await loadCollections(rootPath);
      if (loaded.length > 0) {
        setCollections(loaded);
        setActiveCollectionId(loaded[0].id);
        setActiveFolderId(loaded[0].folders[0]?.id);
        const firstRequest = loaded[0].requests[0];
        if (firstRequest) {
          props.onSelectRequest(firstRequest.request, firstRequest.id);
        }
      }
      setStatus(loaded.length > 0 ? `Loaded ${loaded.length}` : "No collections");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  async function onSave() {
    const rootPath = workspaceRoot().trim() || ".";
    localStorage.setItem("velofire.workspaceRoot", rootPath);
    setStatus("Saving");
    try {
      await Promise.all(collections().map((collection) => saveCollection(rootPath, collection)));
      setStatus(`Saved ${collections().length}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  function onNewCollection() {
    const name = prompt("Collection name", "New Collection")?.trim();
    if (!name) {
      return;
    }

    const collection: Collection = {
      id: stableId("collection", `${name}:${Date.now()}`),
      name,
      folders: [],
      requests: [],
    };
    setCollections((items) => [...items, collection]);
    setActiveCollectionId(collection.id);
    setActiveFolderId(undefined);
  }

  function onNewFolder() {
    const collection = activeCollection();
    if (!collection) {
      return;
    }

    const name = prompt("Folder name", "New Folder")?.trim();
    if (!name) {
      return;
    }

    const folder: CollectionFolder = {
      id: stableId("folder", `${collection.id}:${name}:${Date.now()}`),
      name,
      sort_order: collection.folders.length,
    };
    setCollections((items) =>
      items.map((item) =>
        item.id === collection.id ? { ...item, folders: [...item.folders, folder] } : item,
      ),
    );
    setActiveFolderId(folder.id);
  }

  function onNewRequest(folderId?: string) {
    const collection = activeCollection();
    if (!collection) {
      return;
    }

    const saved = makeSavedRequest(
      {
        ...cloneRequest(props.currentRequest, "New Request"),
        id: stableId("request", `${collection.id}:${Date.now()}`),
        url: "",
        query_params: [],
        headers: [],
      },
      collection.id,
      folderId,
    );
    setCollections((items) =>
      items.map((item) =>
        item.id === collection.id ? { ...item, requests: [...item.requests, saved] } : item,
      ),
    );
    setActiveFolderId(folderId);
    props.onCreateRequest(saved.request, saved.id);
  }

  function selectRequest(collectionId: string, saved: SavedRequest) {
    setActiveCollectionId(collectionId);
    setActiveFolderId(saved.folder_id);
    props.onSelectRequest(saved.request, saved.id);
  }

  function requestsForFolder(collection: Collection, folderId?: string): SavedRequest[] {
    return collection.requests.filter((request) => request.folder_id === folderId);
  }

  return (
    <aside class="sidebar">
      <div class="sidebar-header">
        <span class="section-label">Collections</span>
        <div class="sidebar-actions">
          <button class="icon-button" type="button" aria-label="New request" onClick={() => onNewRequest(activeFolderId())}>+</button>
          <button class="icon-button" type="button" aria-label="New folder" onClick={onNewFolder}>F</button>
          <button class="icon-button" type="button" aria-label="New collection" onClick={onNewCollection}>C</button>
        </div>
      </div>

      <div class="collection-list">
        <For each={collections()}>
          {(collection) => (
            <section class="collection-group">
              <button
                class={`collection-row open ${activeCollectionId() === collection.id ? "active" : ""}`}
                type="button"
                onClick={() => {
                  setActiveCollectionId(collection.id);
                  setActiveFolderId(undefined);
                }}
              >
                <span class="chevron">v</span>
                <span class="folder">{collection.name}</span>
              </button>

              <For each={requestsForFolder(collection)}>
                {(saved) => (
                  <button
                    class={`request-row ${props.selectedRequestId === saved.id ? "active" : ""}`}
                    type="button"
                    onClick={() => selectRequest(collection.id, saved)}
                  >
                    <span class={`method ${methodClass(saved.request.method)}`}>{methodLabel(saved.request.method)}</span>
                    <span>{saved.name}</span>
                  </button>
                )}
              </For>

              <For each={collection.folders}>
                {(folder) => (
                  <section class="folder-group">
                    <button
                      class={`collection-row folder-row ${activeFolderId() === folder.id ? "active" : ""}`}
                      type="button"
                      onClick={() => {
                        setActiveCollectionId(collection.id);
                        setActiveFolderId(folder.id);
                      }}
                    >
                      <span class="chevron">v</span>
                      <span class="folder">{folder.name}</span>
                    </button>
                    <For each={requestsForFolder(collection, folder.id)}>
                      {(saved) => (
                        <button
                          class={`request-row ${props.selectedRequestId === saved.id ? "active" : ""}`}
                          type="button"
                          onClick={() => selectRequest(collection.id, saved)}
                        >
                          <span class={`method ${methodClass(saved.request.method)}`}>{methodLabel(saved.request.method)}</span>
                          <span>{saved.name}</span>
                        </button>
                      )}
                    </For>
                  </section>
                )}
              </For>

              <Show when={collection.requests.length === 0}>
                <button class="request-row muted" type="button" onClick={() => onNewRequest()}>
                  <span class="method get">GET</span>
                  <span>New request</span>
                </button>
              </Show>
            </section>
          )}
        </For>
      </div>

      <div class="sidebar-footer">
        <input
          class="workspace-path"
          aria-label="Workspace path"
          value={workspaceRoot()}
          onInput={(event) => setWorkspaceRoot(event.currentTarget.value)}
        />
        <div class="sidebar-save-load">
          <button class="sidebar-tool" type="button" onClick={onLoad}>Load</button>
          <button class="sidebar-tool" type="button" onClick={onSave}>Save</button>
        </div>
        <div class="sidebar-status" title={status()}>{status()}</div>
      </div>
    </aside>
  );
}
