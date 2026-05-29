import { createMemo, createSignal, For, Show } from "solid-js";
import type { ApiResponse } from "../../types";

const responseTabs = ["Body", "Headers", "Status", "Timing"] as const;
type ResponseTab = (typeof responseTabs)[number];

interface ResponseViewerProps {
  response: ApiResponse | null;
  message: string | null;
}

function prettyBody(response: ApiResponse | null): string {
  if (!response) {
    return "{\n  \"status\": \"ready\"\n}";
  }

  const contentType = response.content_type ?? response.headers.find((header) => header.key.toLowerCase() === "content-type")?.value ?? "";
  if (!contentType.includes("json")) {
    return response.body_text;
  }

  try {
    return JSON.stringify(JSON.parse(response.body_text), null, 2);
  } catch {
    return response.body_text;
  }
}

export function ResponseViewer(props: ResponseViewerProps) {
  const [activeTab, setActiveTab] = createSignal<ResponseTab>("Body");
  const [bodyMode, setBodyMode] = createSignal<"pretty" | "raw">("pretty");

  const displayBody = createMemo(() =>
    bodyMode() === "pretty" ? prettyBody(props.response) : props.response?.body_text ?? "{\n  \"status\": \"ready\"\n}",
  );

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
              </>
            )}
          </Show>
        </div>
        <div class="response-actions">
          <Show when={activeTab() === "Body"}>
            <div class="segmented-control" role="group" aria-label="Body display mode">
              <button class={bodyMode() === "pretty" ? "active" : ""} type="button" onClick={() => setBodyMode("pretty")}>Pretty</button>
              <button class={bodyMode() === "raw" ? "active" : ""} type="button" onClick={() => setBodyMode("raw")}>Raw</button>
            </div>
          </Show>
          <button class="ghost-button" type="button" onClick={() => navigator.clipboard?.writeText(displayBody())}>
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

      <Show when={activeTab() === "Body"}>
        <pre class="code-view" aria-label="Response body"><code>{props.message ?? displayBody()}</code></pre>
      </Show>

      <Show when={activeTab() === "Headers"}>
        <div class="response-detail-table">
          <For each={props.response?.headers ?? []}>
            {(header) => (
              <div class="detail-row">
                <span>{header.key}</span>
                <code>{header.value}</code>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={activeTab() === "Status"}>
        <dl class="response-facts">
          <div><dt>Status</dt><dd>{props.response ? `${props.response.status} ${props.response.status_text}` : "Not sent"}</dd></div>
          <div><dt>Final URL</dt><dd>{props.response?.final_url ?? "-"}</dd></div>
          <div><dt>Content Type</dt><dd>{props.response?.content_type ?? "-"}</dd></div>
          <div><dt>Body Size</dt><dd>{props.response ? `${props.response.body_bytes_len} B` : "-"}</dd></div>
        </dl>
      </Show>

      <Show when={activeTab() === "Timing"}>
        <dl class="response-facts">
          <div><dt>Duration</dt><dd>{props.response ? `${props.response.duration_ms} ms` : "-"}</dd></div>
          <div><dt>Started</dt><dd>{props.response ? new Date(props.response.started_at_ms).toLocaleString() : "-"}</dd></div>
          <div><dt>Finished</dt><dd>{props.response ? new Date(props.response.finished_at_ms).toLocaleString() : "-"}</dd></div>
        </dl>
      </Show>
    </section>
  );
}
