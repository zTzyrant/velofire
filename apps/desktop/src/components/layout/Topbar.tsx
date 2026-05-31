import { For, Show } from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DropdownMenu, DropdownMenuItem } from "../ui";

function getAppWindow() {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return null;
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

const appWindow = getAppWindow();

function WindowControls() {
  if (!appWindow) return null;

  return (
    <div class="flex items-center gap-[6px] shrink-0 pl-2 pr-1">
      <button
        type="button"
        class="group grid h-[11px] w-[11px] place-items-center rounded-full border-0 p-0 text-[rgba(0,0,0,0.45)] transition-transform duration-150 hover:scale-110"
        style={{ background: "#ff5f57" }}
        title="Close"
        onClick={() => appWindow.close()}
      >
        <svg class="pointer-events-none opacity-0 transition-opacity duration-150 group-hover:opacity-100" width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <button
        type="button"
        class="group grid h-[11px] w-[11px] place-items-center rounded-full border-0 p-0 text-[rgba(0,0,0,0.45)] transition-transform duration-150 hover:scale-110"
        style={{ background: "#febc2e" }}
        title="Minimize"
        onClick={() => appWindow.minimize()}
      >
        <svg class="pointer-events-none opacity-0 transition-opacity duration-150 group-hover:opacity-100" width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <button
        type="button"
        class="group grid h-[11px] w-[11px] place-items-center rounded-full border-0 p-0 text-[rgba(0,0,0,0.45)] transition-transform duration-150 hover:scale-110"
        style={{ background: "#28c840" }}
        title="Maximize"
        onClick={() => appWindow.toggleMaximize()}
      >
        <svg class="pointer-events-none opacity-0 transition-opacity duration-150 group-hover:opacity-100" width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        </svg>
      </button>
    </div>
  );
}

export type AppMenuItem = {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  run: () => void | Promise<void>;
};

export type AppMenuGroup = {
  label: string;
  items: AppMenuItem[];
};

export interface TopbarProps {
  appMenuGroups: AppMenuGroup[];
  onSend: () => void;
  loading: boolean;
}

function runMenuItem(item: AppMenuItem) {
  if (item.disabled) return;
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  void item.run();
}

export function Topbar(props: TopbarProps) {
  return (
    <header
      data-tauri-drag-region
      class="grid items-center min-w-0 min-h-0 h-8 overflow-visible"
      style={{
        "grid-template-columns": "1fr auto 1fr",
        "border-bottom": "1px solid var(--outline-soft)",
        background: "color-mix(in srgb, var(--surface) 88%, black)",
      }}
    >
      {/* LEFT: Window controls + app menus */}
      <div class="flex items-center min-w-0 h-full overflow-visible">
        <WindowControls />
        <nav
          class="relative z-[12] h-full min-w-0 gap-0 pr-1 flex items-center"
          aria-label="Application menu"
        >
          <For each={props.appMenuGroups}>
            {(group) => (
              <div class="group relative h-full">
                <button
                  class="h-full border-0 border-none rounded-none bg-transparent text-[color-mix(in_srgb,var(--text-muted)_92%,white)] px-[7px] text-[11px] hover:bg-[var(--surface-high)] hover:text-[var(--text)] hover:shadow-none group-hover:bg-[var(--surface-high)] group-hover:text-[var(--text)] group-hover:shadow-none group-focus-within:bg-[var(--surface-high)] group-focus-within:text-[var(--text)] group-focus-within:shadow-none"
                  type="button"
                  aria-haspopup="menu"
                >
                  {group.label}
                </button>
                <DropdownMenu
                  class="absolute top-full left-0 z-40 hidden w-max min-w-[178px] p-[5px] border border-[var(--outline-soft)] rounded-md shadow-[0_14px_32px_rgb(0_0_0/34%)] group-hover:grid group-focus-within:grid"
                  style={{
                    "max-width": "min(280px, calc(100vw - 16px))",
                    background: "color-mix(in srgb, var(--surface) 96%, black)",
                  }}
                  aria-label={`${group.label} menu`}
                >
                  <For each={group.items}>
                    {(item) => (
                      <DropdownMenuItem
                        class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 w-full h-[26px] border-0 rounded bg-transparent text-[var(--text)] px-[7px] text-left whitespace-nowrap hover:bg-[var(--surface-high)] hover:shadow-none disabled:text-[color-mix(in_srgb,var(--text-muted)_55%,transparent)] [&_span]:overflow-hidden [&_span]:text-ellipsis"
                        disabled={item.disabled}
                        onClick={() => runMenuItem(item)}
                      >
                        <span>{item.label}</span>
                        <Show when={item.shortcut}>
                          <kbd>{item.shortcut}</kbd>
                        </Show>
                      </DropdownMenuItem>
                    )}
                  </For>
                </DropdownMenu>
              </div>
            )}
          </For>
        </nav>
      </div>

      {/* CENTER: Velofire title */}
      <div class="flex items-center justify-center h-full min-w-0" data-tauri-drag-region>
        <span
          class="grid place-items-center w-5 h-5 rounded text-[11px] font-extrabold leading-none"
          style={{
            background: "color-mix(in srgb, var(--primary) 90%, white)",
            color: "var(--primary-ink)",
          }}
        >
          V
        </span>
        <span class="text-[13px] font-semibold ml-1.5">Velofire</span>
      </div>

      {/* RIGHT: Send button */}
      <div class="flex items-center justify-end h-full min-w-0 overflow-hidden px-1.5">
        <button
          class="rounded bg-[var(--primary-strong)] px-4 py-1 text-xs font-semibold text-white hover:bg-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={props.onSend}
          disabled={props.loading}
        >
          {props.loading ? "Sending" : "Send"}
        </button>
      </div>
    </header>
  );
}
