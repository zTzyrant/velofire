import { Show, For } from "solid-js";
import { cn } from "../../lib/utils";

export interface CommandAction {
  label: string;
  shortcut?: string;
  run: () => void | Promise<void>;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  actions: CommandAction[];
}

export function CommandPalette(props: CommandPaletteProps) {
  let backdropRef: HTMLDivElement | undefined;

  async function handleRun(action: CommandAction) {
    await action.run();
    props.onClose();
  }

  return (
    <Show when={props.open}>
      <div
        ref={backdropRef}
        class="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
        style={{ "background-color": "rgba(0,0,0,0.5)" }}
        onMouseDown={() => props.onClose()}
      >
        <section
          class="w-full max-w-md rounded-lg border"
          style={{
            "background-color": "#1d2027",
            "border-color": "#424754",
          }}
          aria-label="Command palette"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div
            class="flex items-center justify-between px-4 py-3 border-b"
            style={{"border-color": "#424754"}}
          >
            <span class="text-sm font-medium" style={{ color: "#e1e2ec" }}>
              Commands
            </span>
            <kbd
              class="rounded border px-1.5 py-0.5 text-xs"
              style={{
                "background-color": "#10131a",
                "border-color": "#424754",
                color: "#c2c6d6",
              }}
            >
              Esc
            </kbd>
          </div>
          <div class="max-h-72 overflow-y-auto p-1">
            <For each={props.actions}>
              {(action) => (
                <button
                  type="button"
                  class="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors"
                  style={{ color: "#e1e2ec" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style["background-color"] = "#424754")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style["background-color"] = "transparent")
                  }
                  onClick={() => handleRun(action)}
                >
                  <span>{action.label}</span>
                  <Show when={action.shortcut}>
                    <kbd
                      class="ml-4 rounded border px-1.5 py-0.5 text-xs"
                      style={{
                        "background-color": "#10131a",
                        "border-color": "#424754",
                        color: "#c2c6d6",
                      }}
                    >
                      {action.shortcut}
                    </kbd>
                  </Show>
                </button>
              )}
            </For>
          </div>
        </section>
      </div>
    </Show>
  );
}
