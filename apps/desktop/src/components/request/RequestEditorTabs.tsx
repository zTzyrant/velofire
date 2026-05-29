import { createMemo, createSignal, For, Show } from "solid-js";
import type { ApiRequest, Auth, FormField, Header, RequestBody } from "../../types";

const tabs = ["Params", "Headers", "Auth", "Body", "Scripts"] as const;
type EditorTab = (typeof tabs)[number];

interface RequestEditorTabsProps {
  request: ApiRequest;
  message: string | null;
  runtime: string;
  updateRequest: (updater: (request: ApiRequest) => ApiRequest) => void;
}

function bodyText(body: RequestBody): string {
  if (body.type === "json") return JSON.stringify(body.value, null, 2);
  if (body.type === "raw_text" || body.type === "xml") return body.value;
  return "";
}

function bodyForType(type: RequestBody["type"], current: RequestBody): RequestBody {
  if (type === "none") return { type: "none" };
  if (type === "form_data" || type === "url_encoded") {
    return current.type === "form_data" || current.type === "url_encoded"
      ? { type, fields: current.fields }
      : { type, fields: [{ key: "", value: "", enabled: true }] };
  }
  const value = bodyText(current);
  if (type === "json") {
    try {
      return { type: "json", value: JSON.parse(value || "{}") };
    } catch {
      return { type: "json", value };
    }
  }
  if (type === "xml") return { type: "xml", value };
  return { type: "raw_text", value };
}

function applyBodyText(type: RequestBody["type"], value: string): RequestBody {
  if (type === "none") return { type: "none" };
  if (type === "json") {
    try {
      return { type: "json", value: JSON.parse(value || "{}") };
    } catch {
      return { type: "json", value };
    }
  }
  if (type === "xml") return { type: "xml", value };
  if (type === "raw_text") return { type: "raw_text", value };
  return { type, fields: [] };
}

function authLabel(auth: Auth): string {
  if (auth.type === "api_key") return "API Key";
  if (auth.type === "bearer") return "Bearer";
  if (auth.type === "basic") return "Basic";
  return "None";
}

function nextAuth(type: Auth["type"], current: Auth): Auth {
  if (type === "none") return { type: "none" };
  if (type === "bearer") return current.type === "bearer" ? current : { type: "bearer", token: "" };
  if (type === "basic") {
    return current.type === "basic" ? current : { type: "basic", username: "", password: "" };
  }
  return current.type === "api_key"
    ? current
    : { type: "api_key", key: "x-api-key", value: "", location: "header" };
}

export function RequestEditorTabs(props: RequestEditorTabsProps) {
  const [activeTab, setActiveTab] = createSignal<EditorTab>("Params");

  function updateRow(kind: "query_params" | "headers", index: number, patch: Partial<Header>) {
    props.updateRequest((request) => ({
      ...request,
      [kind]: request[kind].map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    }));
  }

  function addRow(kind: "query_params" | "headers") {
    props.updateRequest((request) => ({
      ...request,
      [kind]: [...request[kind], { key: "", value: "", enabled: true }],
    }));
  }

  function removeRow(kind: "query_params" | "headers", index: number) {
    props.updateRequest((request) => ({
      ...request,
      [kind]: request[kind].filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function updateAuth(auth: Auth) {
    props.updateRequest((request) => ({ ...request, auth }));
  }

  return (
    <div class="editor-grid">
      <div class="panel request-config">
        <div class="panel-tabs" role="tablist" aria-label="Request configuration">
          <For each={tabs}>
            {(tab) => (
              <button
                class={`panel-tab ${activeTab() === tab ? "active" : ""}`}
                type="button"
                role="tab"
                aria-selected={activeTab() === tab}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
                <Show when={tab === "Headers"}>
                  <span class="count">{props.request.headers.length}</span>
                </Show>
                <Show when={tab === "Params"}>
                  <span class="count">{props.request.query_params.length}</span>
                </Show>
              </button>
            )}
          </For>
        </div>

        <Show when={activeTab() === "Params"}>
          <KeyValueTable
            rows={props.request.query_params}
            label="Parameter"
            onUpdate={(index, patch) => updateRow("query_params", index, patch)}
            onAdd={() => addRow("query_params")}
            onRemove={(index) => removeRow("query_params", index)}
          />
        </Show>

        <Show when={activeTab() === "Headers"}>
          <KeyValueTable
            rows={props.request.headers}
            label="Header"
            onUpdate={(index, patch) => updateRow("headers", index, patch)}
            onAdd={() => addRow("headers")}
            onRemove={(index) => removeRow("headers", index)}
          />
        </Show>

        <Show when={activeTab() === "Auth"}>
          <AuthEditor auth={props.request.auth} onChange={updateAuth} />
        </Show>

        <Show when={activeTab() === "Body"}>
          <BodyEditor
            body={props.request.body}
            onChange={(body) => props.updateRequest((request) => ({ ...request, body }))}
          />
        </Show>

        <Show when={activeTab() === "Scripts"}>
          <ScriptEditor
            preRequest={props.request.scripts?.pre_request ?? ""}
            postRequest={props.request.scripts?.post_request ?? ""}
            onChange={(scripts) => props.updateRequest((request) => ({ ...request, scripts }))}
          />
        </Show>
      </div>

      <aside class="panel inspector">
        <div class="panel-title">Request</div>
        <dl class="meta-list">
          <div><dt>Name</dt><dd>{props.request.name}</dd></div>
          <div><dt>Auth</dt><dd>{authLabel(props.request.auth)}</dd></div>
          <div><dt>Body</dt><dd>{props.request.body.type}</dd></div>
          <div><dt>Scripts</dt><dd>{props.request.scripts?.pre_request || props.request.scripts?.post_request ? "Configured" : "None"}</dd></div>
          <div><dt>Timeout</dt><dd>{props.request.timeout_ms / 1000}s</dd></div>
          <div><dt>Runtime</dt><dd>{props.runtime}</dd></div>
        </dl>
        <Show when={props.message}>
          {(message) => <p class="panel-message">{message()}</p>}
        </Show>
      </aside>
    </div>
  );
}

function KeyValueTable(props: {
  rows: Header[];
  label: string;
  onUpdate: (index: number, patch: Partial<Header>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div class="key-value-table" aria-label={`${props.label} editor`}>
      <div class="table-head">
        <span>Key</span>
        <span>Value</span>
        <span>On</span>
      </div>
      <For each={props.rows}>
        {(row, index) => (
          <label class="table-row">
            <input
              value={row.key}
              aria-label={`${props.label} key`}
              onInput={(event) => props.onUpdate(index(), { key: event.currentTarget.value })}
            />
            <input
              value={row.value}
              aria-label={`${props.label} value`}
              onInput={(event) => props.onUpdate(index(), { value: event.currentTarget.value })}
            />
            <span class="row-actions">
              <input
                type="checkbox"
                checked={row.enabled}
                aria-label={`${props.label} enabled`}
                onInput={(event) => props.onUpdate(index(), { enabled: event.currentTarget.checked })}
              />
              <button type="button" class="mini-button" onClick={() => props.onRemove(index())}>
                Remove
              </button>
            </span>
          </label>
        )}
      </For>
      <button class="table-add" type="button" onClick={props.onAdd}>
        Add row
      </button>
    </div>
  );
}

function AuthEditor(props: { auth: Auth; onChange: (auth: Auth) => void }) {
  return (
    <div class="form-panel">
      <label class="field-stack compact">
        <span>Type</span>
        <select
          value={props.auth.type}
          onInput={(event) => props.onChange(nextAuth(event.currentTarget.value as Auth["type"], props.auth))}
        >
          <option value="none">None</option>
          <option value="bearer">Bearer</option>
          <option value="basic">Basic</option>
          <option value="api_key">API Key</option>
        </select>
      </label>

      <Show when={props.auth.type === "bearer" && props.auth}>
        {(auth) => (
          <label class="field-stack">
            <span>Token</span>
            <input
              type="password"
              value={(auth() as Extract<Auth, { type: "bearer" }>).token}
              onInput={(event) => props.onChange({ type: "bearer", token: event.currentTarget.value })}
            />
          </label>
        )}
      </Show>

      <Show when={props.auth.type === "basic" && props.auth}>
        {(auth) => {
          const basic = () => auth() as Extract<Auth, { type: "basic" }>;
          return (
            <div class="two-column-fields">
              <label class="field-stack">
                <span>Username</span>
                <input
                  value={basic().username}
                  onInput={(event) => props.onChange({ ...basic(), username: event.currentTarget.value })}
                />
              </label>
              <label class="field-stack">
                <span>Password</span>
                <input
                  type="password"
                  value={basic().password}
                  onInput={(event) => props.onChange({ ...basic(), password: event.currentTarget.value })}
                />
              </label>
            </div>
          );
        }}
      </Show>

      <Show when={props.auth.type === "api_key" && props.auth}>
        {(auth) => {
          const apiKey = () => auth() as Extract<Auth, { type: "api_key" }>;
          return (
            <div class="api-key-fields">
              <label class="field-stack">
                <span>Key</span>
                <input
                  value={apiKey().key}
                  onInput={(event) => props.onChange({ ...apiKey(), key: event.currentTarget.value })}
                />
              </label>
              <label class="field-stack">
                <span>Value</span>
                <input
                  type="password"
                  value={apiKey().value}
                  onInput={(event) => props.onChange({ ...apiKey(), value: event.currentTarget.value })}
                />
              </label>
              <label class="field-stack compact">
                <span>Add to</span>
                <select
                  value={apiKey().location}
                  onInput={(event) =>
                    props.onChange({ ...apiKey(), location: event.currentTarget.value as "header" | "query" })
                  }
                >
                  <option value="header">Header</option>
                  <option value="query">Query</option>
                </select>
              </label>
            </div>
          );
        }}
      </Show>
    </div>
  );
}

function BodyEditor(props: { body: RequestBody; onChange: (body: RequestBody) => void }) {
  const value = createMemo(() => bodyText(props.body));

  function updateField(index: number, patch: Partial<FormField>) {
    if (props.body.type !== "form_data" && props.body.type !== "url_encoded") {
      return;
    }
    props.onChange({
      ...props.body,
      fields: props.body.fields.map((field, rowIndex) => (rowIndex === index ? { ...field, ...patch } : field)),
    });
  }

  function addField() {
    if (props.body.type !== "form_data" && props.body.type !== "url_encoded") {
      return;
    }
    props.onChange({ ...props.body, fields: [...props.body.fields, { key: "", value: "", enabled: true }] });
  }

  function removeField(index: number) {
    if (props.body.type !== "form_data" && props.body.type !== "url_encoded") {
      return;
    }
    props.onChange({ ...props.body, fields: props.body.fields.filter((_, rowIndex) => rowIndex !== index) });
  }

  return (
    <div class="body-editor">
      <label class="field-stack compact">
        <span>Type</span>
        <select
          value={props.body.type}
          onInput={(event) => props.onChange(bodyForType(event.currentTarget.value as RequestBody["type"], props.body))}
        >
          <option value="none">None</option>
          <option value="json">JSON</option>
          <option value="form_data">Form data</option>
          <option value="url_encoded">URL encoded</option>
          <option value="raw_text">Raw</option>
          <option value="xml">XML</option>
        </select>
      </label>

      <Show when={props.body.type === "form_data" || props.body.type === "url_encoded"}>
        <KeyValueTable
          rows={(props.body.type === "form_data" || props.body.type === "url_encoded") ? props.body.fields : []}
          label="Body field"
          onUpdate={updateField}
          onAdd={addField}
          onRemove={removeField}
        />
      </Show>

      <Show when={props.body.type !== "none" && props.body.type !== "form_data" && props.body.type !== "url_encoded"}>
        <textarea
          class="body-textarea"
          value={value()}
          spellcheck={false}
          aria-label="Request body"
          onInput={(event) => props.onChange(applyBodyText(props.body.type, event.currentTarget.value))}
        />
      </Show>
    </div>
  );
}

function ScriptEditor(props: {
  preRequest: string;
  postRequest: string;
  onChange: (scripts: { pre_request: string; post_request: string }) => void;
}) {
  return (
    <div class="script-editor">
      <label class="field-stack">
        <span>Pre-request</span>
        <textarea
          class="body-textarea"
          spellcheck={false}
          value={props.preRequest}
          onInput={(event) => props.onChange({ pre_request: event.currentTarget.value, post_request: props.postRequest })}
        />
      </label>
      <label class="field-stack">
        <span>Post-request</span>
        <textarea
          class="body-textarea"
          spellcheck={false}
          value={props.postRequest}
          onInput={(event) => props.onChange({ pre_request: props.preRequest, post_request: event.currentTarget.value })}
        />
      </label>
    </div>
  );
}
