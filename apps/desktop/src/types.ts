export type HttpMethod = "Get" | "Post" | "Put" | "Patch" | "Delete" | "Head" | "Options";

export interface Header {
  key: string;
  value: string;
  enabled: boolean;
}

export type QueryParam = Header;

export interface FormField {
  key: string;
  value: string;
  enabled: boolean;
}

export type RequestBody =
  | { type: "none" }
  | { type: "json"; value: unknown }
  | { type: "form_data"; fields: FormField[] }
  | { type: "url_encoded"; fields: FormField[] }
  | { type: "raw_text"; value: string }
  | { type: "xml"; value: string };

export type ApiKeyLocation = "header" | "query";

export type Auth =
  | { type: "none" }
  | { type: "bearer"; token: string }
  | { type: "basic"; username: string; password: string }
  | { type: "api_key"; key: string; value: string; location: ApiKeyLocation };

export interface ApiRequest {
  id?: string;
  name?: string;
  path: string[];
  method: HttpMethod;
  url: string;
  query_params: QueryParam[];
  headers: Header[];
  body: RequestBody;
  auth: Auth;
  timeout_ms: number;
  metadata: Record<string, string>;
}

export interface ApiResponse {
  status: number;
  status_text: string;
  headers: Header[];
  body_text: string;
  body_bytes_len: number;
  content_type?: string;
  duration_ms: number;
  started_at_ms: number;
  finished_at_ms: number;
  final_url: string;
}

export interface Collection {
  id: string;
  workspace_id?: string;
  name: string;
  folders: CollectionFolder[];
  requests: SavedRequest[];
  created_at?: string;
  updated_at?: string;
}

export interface CollectionFolder {
  id: string;
  name: string;
  parent_id?: string;
  sort_order: number;
}

export interface SavedRequest {
  id: string;
  collection_id?: string;
  folder_id?: string;
  name: string;
  request: ApiRequest;
  created_at?: string;
  updated_at?: string;
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  is_secret: boolean;
  enabled: boolean;
}

export interface RequestHistoryItem {
  id: string;
  name: string;
  request: ApiRequest;
  status?: number;
  duration_ms?: number;
  created_at: string;
}
