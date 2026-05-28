import type {
  ApiKeyLocation,
  ApiRequest,
  Auth,
  Collection,
  FormField,
  Header,
  HttpMethod,
  QueryParam,
  RequestBody,
  SavedRequest,
} from "../types";

export type KeyValueRow = Header | QueryParam | FormField;
export type KeyValueRowPatch = Partial<Pick<KeyValueRow, "key" | "value" | "enabled">>;
export type BodyType = RequestBody["type"];
export type AuthType = Auth["type"];

export const DEFAULT_TIMEOUT_MS = 30_000;

export function stableId(prefix: string, value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `${prefix}-${hash.toString(16).padStart(16, "0")}`;
}

export function createKeyValueRow(key = "", value = "", enabled = true): Header {
  return { key, value, enabled };
}

export function createFormField(key = "", value = "", enabled = true): FormField {
  return { key, value, enabled };
}

export function defaultRequest(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    id: "request-preview",
    name: "Get Profile",
    path: ["Users"],
    method: "Get",
    url: "https://httpbin.org/get",
    query_params: [
      createKeyValueRow("include_meta", "true"),
      createKeyValueRow("fields", "id,email,role,last_login"),
    ],
    headers: [createKeyValueRow("Accept", "application/json")],
    body: { type: "none" },
    auth: { type: "none" },
    timeout_ms: DEFAULT_TIMEOUT_MS,
    metadata: {},
    ...overrides,
  };
}

export function newRequest(name = "Untitled Request", method: HttpMethod = "Get"): ApiRequest {
  return defaultRequest({
    id: stableId("request", `${name}:${Date.now()}`),
    name,
    path: [],
    method,
    url: "",
    query_params: [],
    headers: [],
  });
}

export function updateRequest(request: ApiRequest, patch: Partial<ApiRequest>): ApiRequest {
  return { ...request, ...patch };
}

export function updateRequestMethod(request: ApiRequest, method: HttpMethod): ApiRequest {
  return updateRequest(request, { method });
}

export function updateRequestUrl(request: ApiRequest, url: string): ApiRequest {
  return updateRequest(request, { url });
}

export function updateRow<T extends KeyValueRow>(rows: T[], index: number, patch: KeyValueRowPatch): T[] {
  return rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
}

export function addRow<T extends KeyValueRow>(rows: T[], row: T): T[] {
  return [...rows, row];
}

export function removeRow<T extends KeyValueRow>(rows: T[], index: number): T[] {
  return rows.filter((_, rowIndex) => rowIndex !== index);
}

export function toggleRow<T extends KeyValueRow>(rows: T[], index: number): T[] {
  return rows.map((row, rowIndex) =>
    rowIndex === index ? { ...row, enabled: !row.enabled } : row,
  );
}

export function upsertRow<T extends KeyValueRow>(rows: T[], key: string, value: string, enabled = true): T[] {
  const existingIndex = rows.findIndex((row) => row.key.toLowerCase() === key.toLowerCase());
  if (existingIndex === -1) {
    return [...rows, { key, value, enabled } as T];
  }
  return updateRow(rows, existingIndex, { value, enabled });
}

export function updateParamRow(request: ApiRequest, index: number, patch: KeyValueRowPatch): ApiRequest {
  return updateRequest(request, { query_params: updateRow(request.query_params, index, patch) });
}

export function addParamRow(request: ApiRequest, row = createKeyValueRow()): ApiRequest {
  return updateRequest(request, { query_params: addRow(request.query_params, row) });
}

export function removeParamRow(request: ApiRequest, index: number): ApiRequest {
  return updateRequest(request, { query_params: removeRow(request.query_params, index) });
}

export function updateHeaderRow(request: ApiRequest, index: number, patch: KeyValueRowPatch): ApiRequest {
  return updateRequest(request, { headers: updateRow(request.headers, index, patch) });
}

export function addHeaderRow(request: ApiRequest, row = createKeyValueRow()): ApiRequest {
  return updateRequest(request, { headers: addRow(request.headers, row) });
}

export function removeHeaderRow(request: ApiRequest, index: number): ApiRequest {
  return updateRequest(request, { headers: removeRow(request.headers, index) });
}

export function bodyForType(type: BodyType): RequestBody {
  switch (type) {
    case "json":
      return { type, value: {} };
    case "form_data":
    case "url_encoded":
      return { type, fields: [] };
    case "raw_text":
    case "xml":
      return { type, value: "" };
    case "none":
      return { type };
  }
}

export function setBodyType(request: ApiRequest, type: BodyType): ApiRequest {
  return updateRequest(request, { body: bodyForType(type) });
}

export function updateBodyValue(request: ApiRequest, value: string | unknown): ApiRequest {
  const body = request.body;
  if (body.type === "json") {
    return updateRequest(request, { body: { ...body, value } });
  }
  if (body.type === "raw_text" || body.type === "xml") {
    return updateRequest(request, { body: { ...body, value: String(value) } });
  }
  return request;
}

export function updateBodyField(request: ApiRequest, index: number, patch: KeyValueRowPatch): ApiRequest {
  const body = request.body;
  if (body.type !== "form_data" && body.type !== "url_encoded") {
    return request;
  }
  return updateRequest(request, { body: { ...body, fields: updateRow(body.fields, index, patch) } });
}

export function addBodyField(request: ApiRequest, row = createFormField()): ApiRequest {
  const body = request.body;
  if (body.type !== "form_data" && body.type !== "url_encoded") {
    return request;
  }
  return updateRequest(request, { body: { ...body, fields: addRow(body.fields, row) } });
}

export function removeBodyField(request: ApiRequest, index: number): ApiRequest {
  const body = request.body;
  if (body.type !== "form_data" && body.type !== "url_encoded") {
    return request;
  }
  return updateRequest(request, { body: { ...body, fields: removeRow(body.fields, index) } });
}

export function authForType(type: AuthType): Auth {
  switch (type) {
    case "bearer":
      return { type, token: "" };
    case "basic":
      return { type, username: "", password: "" };
    case "api_key":
      return { type, key: "", value: "", location: "header" };
    case "none":
      return { type };
  }
}

export function setAuthType(request: ApiRequest, type: AuthType): ApiRequest {
  return updateRequest(request, { auth: authForType(type) });
}

export function updateAuth(request: ApiRequest, patch: Partial<Omit<Auth, "type">>): ApiRequest {
  return updateRequest(request, { auth: { ...request.auth, ...patch } as Auth });
}

export function setApiKeyLocation(request: ApiRequest, location: ApiKeyLocation): ApiRequest {
  if (request.auth.type !== "api_key") {
    return request;
  }
  return updateAuth(request, { location });
}

export function createCollection(name = "New Collection", requests: SavedRequest[] = []): Collection {
  return {
    id: stableId("collection", name),
    name,
    folders: [],
    requests,
  };
}

export function createSavedRequest(request: ApiRequest, name = request.name ?? "Untitled Request"): SavedRequest {
  return {
    id: request.id ?? stableId("saved-request", `${name}:${request.method}:${request.url}`),
    name,
    request: { ...request, name },
  };
}

export function addSavedRequest(collection: Collection, savedRequest: SavedRequest): Collection {
  return { ...collection, requests: [...collection.requests, savedRequest] };
}

export function updateSavedRequest(
  collection: Collection,
  requestId: string,
  updater: (savedRequest: SavedRequest) => SavedRequest,
): Collection {
  return {
    ...collection,
    requests: collection.requests.map((savedRequest) =>
      savedRequest.id === requestId ? updater(savedRequest) : savedRequest,
    ),
  };
}

export function removeSavedRequest(collection: Collection, requestId: string): Collection {
  return {
    ...collection,
    requests: collection.requests.filter((savedRequest) => savedRequest.id !== requestId),
  };
}
