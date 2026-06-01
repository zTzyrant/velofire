import { createSignal, For, Show } from "solid-js";
import { Drawer, DrawerContent, DrawerHeader, DrawerTrigger } from "../ui";

export type ConsoleLogLevel = "network" | "info" | "warning" | "error";

export interface ConsoleLogItem {
  id: string;
  level: ConsoleLogLevel;
  message: string;
  timestamp: string;
  detail?: string;
  status?: number;
  durationMs?: number;
  sizeBytes?: number;
}

function levelClass(level: ConsoleLogLevel): string {
  if (level === "error") return "text-[var(--error)]";
  if (level === "warning") return "text-[var(--warning)]";
  if (level === "network") return "text-[var(--success)]";
  return "text-[var(--primary)]";
}

export function ConsoleDrawer(props: {
  open: boolean;
  logs: ConsoleLogItem[];
  onToggle: () => void;
  onClear: () => void;
  onCopyLogDetail: (item: ConsoleLogItem) => void;
}) {
  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({});
  const toggleExpanded = (id: string) => setExpanded((items) => ({ ...items, [id]: !items[id] }));

  return (
    <Drawer>
      <div class="pointer-events-none absolute inset-x-0 bottom-0 z-20 mx-auto flex max-w-full justify-center px-3">
        <DrawerTrigger onClick={props.onToggle}>
          Console <span class="ml-1 font-mono text-[10px] text-[var(--text-muted)]">{props.logs.length}</span>
        </DrawerTrigger>
      </div>
      <Show when={props.open}>
        <DrawerContent class="h-[220px]">
          <DrawerHeader>
            <div class="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Console
            </div>
            <div class="flex items-center gap-1.5">
              <button class="ghost-button h-6" type="button" onClick={props.onClear}>
                Clear
              </button>
            </div>
          </DrawerHeader>
          <div class="h-[188px] overflow-auto p-2 font-mono text-xs">
            <Show
              when={props.logs.length > 0}
              fallback={<div class="empty-state h-full">No console logs yet.</div>}
            >
              <For each={props.logs}>
                {(item) => (
                  <div class="border-b border-[color-mix(in_srgb,var(--outline-soft)_35%,transparent)] py-1">
                    <div class="grid grid-cols-[18px_74px_64px_minmax(0,1fr)_auto_auto_auto] items-center gap-2">
                      <button
                        class="ghost-button h-5 w-5 px-0 text-[10px]"
                        type="button"
                        disabled={!item.detail}
                        onClick={() => item.detail && toggleExpanded(item.id)}
                        aria-label={expanded()[item.id] ? "Collapse log" : "Expand log"}
                      >
                        {expanded()[item.id] ? "v" : ">"}
                      </button>
                      <span class="text-[var(--text-muted)]">{item.timestamp}</span>
                      <span class={levelClass(item.level)}>{item.level}</span>
                      <span class="min-w-0 overflow-wrap-anywhere text-[var(--text)]" title={item.detail}>
                        {item.message}
                      </span>
                      <Show when={item.status}>
                        {(status) => (
                          <span class={status() >= 400 ? "text-[var(--error)]" : "text-[var(--success)]"}>
                            {status()}
                          </span>
                        )}
                      </Show>
                      <Show when={item.durationMs !== undefined}>
                        <span class="text-[var(--text-muted)]">{item.durationMs}ms</span>
                      </Show>
                      <Show when={item.detail}>
                        <button class="ghost-button h-5" type="button" onClick={() => props.onCopyLogDetail(item)}>
                          Copy
                        </button>
                      </Show>
                    </div>
                    <Show when={expanded()[item.id] && item.detail}>
                      {(detail) => (
                        <pre class="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-[var(--outline-soft)] bg-[var(--bg)] p-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
                          {detail()}
                        </pre>
                      )}
                    </Show>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </DrawerContent>
      </Show>
    </Drawer>
  );
}
