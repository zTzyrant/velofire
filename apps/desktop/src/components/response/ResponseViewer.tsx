import { createMemo, createSignal, For, Show } from "solid-js";
import type { ApiResponse } from "../../types";

const responseTabs = ["Preview", "Raw", "Headers", "Timeline"] as const;
type ResponseTab = (typeof responseTabs)[number];

interface ResponseViewerProps {
  response: ApiResponse | null;
  message: string | null;
}

function prettyBody(response: ApiResponse | null): string {
  if (!response) {
    return "";
  }

  try {
    return JSON.stringify(JSON.parse(response.body_text), null, 2);
  } catch {
    return response.body_text;
  }
}

export function ResponseViewer(props: ResponseViewerProps) {
  const [activeTab, setActiveTab] = createSignal<ResponseTab>("Preview");

  const prettyJsonBody = createMemo(() => props.message ?? prettyBody(props.response));
  const rawBody = createMemo(() => props.message ?? props.response?.body_text ?? "");
  const copyContent = createMemo(() => {
    if (activeTab() === "Headers") {
      return (props.response?.headers ?? []).map((header) => `${header.key}: ${header.value}`).join("\n");
    }

    if (activeTab() === "Timeline") {
      if (!props.response) {
        return "Not sent";
      }

      return [
        `Status: ${props.response.status} ${props.response.status_text}`,
        `Duration: ${props.response.duration_ms} ms`,
        `Body Size: ${props.response.body_bytes_len} B`,
        `Started: ${new Date(props.response.started_at_ms).toLocaleString()}`,
        `Finished: ${new Date(props.response.finished_at_ms).toLocaleString()}`,
        `Final URL: ${props.response.final_url}`,
      ].join("\n");
    }

    return activeTab() === "Preview" ? prettyJsonBody() : rawBody();
  });

  return (
    <section class="response-viewer">
      <div class="response-header">
        <div class="response-meta">
          <Show when={props.response} fallback={<span class="status-chip idle">Idle</span>}>
            {(res) => (
              <>
                <span class="status-chip">{res().status} {res().status_text}</span>
                <span>{res().duration_ms} ms</span>
                <span>{res().body_bytes_len} B</span>
                <Show when={res().body_truncated}>
                  <span class="warning-chip">Truncated</span>
                </Show>
              </>
            )}
          </Show>
        </div>
        <div class="response-actions">
          <button class="ghost-button" type="button" onClick={() => navigator.clipboard?.writeText(copyContent())}>
            Copy
          </button>
        </div>
      </div>

      <div class="response-tabs" role="tablist" aria-label="Response views">
        <For each={responseTabs}>
          {(tab) => (
            <button
              class={`panel-tab ${activeTab() === tab ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={activeTab() === tab}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          )}
        </For>
      </div>

      <Show when={activeTab() === "Preview"}>
        <Show
          when={prettyJsonBody().trim()}
          fallback={<div class="empty-state response-empty">Send a request to see the response preview.</div>}
        >
          <pre class="code-view" aria-label="Response body preview"><code>{prettyJsonBody()}</code></pre>
        </Show>
      </Show>

      <Show when={activeTab() === "Raw"}>
        <Show
          when={rawBody().trim()}
          fallback={<div class="empty-state response-empty">No raw response body yet.</div>}
        >
          <pre class="code-view" aria-label="Raw response body"><code>{rawBody()}</code></pre>
        </Show>
      </Show>

      <Show when={activeTab() === "Headers"}>
        <div class="response-detail-table">
          <Show when={(props.response?.headers.length ?? 0) > 0} fallback={<div class="empty-state">No response headers</div>}>
            <For each={props.response?.headers ?? []}>
              {(header) => (
                <div class="detail-row">
                  <span>{header.key}</span>
                  <code>{header.value}</code>
                </div>
              )}
            </For>
          </Show>
        </div>
      </Show>

      <Show when={activeTab() === "Timeline"}>
        <Show when={props.response} fallback={<div class="empty-state response-empty">Timing details appear after a request completes.</div>}>
          {(res) => (
            <dl class="response-facts">
              <div><dt>Status</dt><dd>{res().status} {res().status_text}</dd></div>
              <div><dt>Duration</dt><dd>{res().duration_ms} ms</dd></div>
              <div><dt>Final URL</dt><dd>{res().final_url}</dd></div>
              <div><dt>Content Type</dt><dd>{res().content_type ?? "-"}</dd></div>
              <div><dt>Body Size</dt><dd>{res().body_bytes_len} B</dd></div>
              <div><dt>Truncated</dt><dd>{res().body_truncated ? "Yes" : "No"}</dd></div>
              <div><dt>Started</dt><dd>{new Date(res().started_at_ms).toLocaleString()}</dd></div>
              <div><dt>Finished</dt><dd>{new Date(res().finished_at_ms).toLocaleString()}</dd></div>
              <div><dt>Headers</dt><dd>{res().headers.length}</dd></div>
            </dl>
          )}
        </Show>
      </Show>
    </section>
  );
}
