import { For } from "solid-js";
import type {
  ApiRequest,
  ApiResponse,
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
  onSend: () => void;
  onUpdateRequest: (updater: (request: ApiRequest) => ApiRequest) => void;
  onStartResponseResize: (event: MouseEvent) => void;
}

export function MainPanel(props: MainPanelProps) {
  return (
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
      {/* Row 1: Request tab */}
      <div class="flex items-center gap-1 overflow-x-auto border-b border-[var(--outline-soft)] bg-[var(--surface)] px-1" role="tablist" aria-label="Open requests">
        <button class="flex items-center gap-1.5 rounded-t px-3 py-1 text-sm font-medium text-[var(--text)]" type="button" role="tab">
          <span class={`inline-block rounded px-1.5 py-0.5 text-xs font-bold uppercase leading-none ${methodClass(props.currentRequest.method)}`}>
            {methodLabel(props.currentRequest.method)}
          </span>
          <span class="truncate max-w-[160px]">{props.currentRequest.name}</span>
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
  );
}
