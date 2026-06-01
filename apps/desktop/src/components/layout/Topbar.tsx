import { For, Show, createSignal, onCleanup } from "solid-js";
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
    <div class="window-controls flex items-center gap-[5px] shrink-0 pl-2 pr-1" data-tauri-drag-region="false">
      <button
        type="button"
        class="window-control close group"
        title="Close"
        aria-label="Close window"
        onClick={() => appWindow.close()}
      >
        <svg class="pointer-events-none" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <button
        type="button"
        class="window-control minimize group"
        title="Minimize"
        aria-label="Minimize window"
        onClick={() => appWindow.minimize()}
      >
        <svg class="pointer-events-none" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <button
        type="button"
        class="window-control maximize group"
        title="Maximize"
        aria-label="Maximize window"
        onClick={() => appWindow.toggleMaximize()}
      >
        <svg class="pointer-events-none" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 7h10v10H7z" />
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
}

function runMenuItem(item: AppMenuItem) {
  if (item.disabled) return;
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  void item.run();
}

export function Topbar(props: TopbarProps) {
  const [openMenuIndex, setOpenMenuIndex] = createSignal<number | null>(null);
  let closeTimer: number | undefined;

  function openMenu(index: number) {
    if (closeTimer) window.clearTimeout(closeTimer);
    setOpenMenuIndex(index);
  }

  function scheduleCloseMenu() {
    if (closeTimer) window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => setOpenMenuIndex(null), 180);
  }

  function closeMenu() {
    if (closeTimer) window.clearTimeout(closeTimer);
    setOpenMenuIndex(null);
  }

  onCleanup(() => {
    if (closeTimer) window.clearTimeout(closeTimer);
  });

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
            {(group, index) => (
              <div
                class="relative h-full"
                onPointerEnter={() => openMenu(index())}
                onPointerLeave={scheduleCloseMenu}
                onFocusIn={() => openMenu(index())}
                onFocusOut={scheduleCloseMenu}
              >
                <button
                  class="h-full border-0 border-none rounded-none bg-transparent text-[color-mix(in_srgb,var(--text-muted)_92%,white)] px-[7px] text-[11px] hover:bg-[var(--surface-high)] hover:text-[var(--text)] hover:shadow-none data-[open=true]:bg-[var(--surface-high)] data-[open=true]:text-[var(--text)] data-[open=true]:shadow-none"
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={openMenuIndex() === index()}
                  data-open={openMenuIndex() === index()}
                  onClick={() => (openMenuIndex() === index() ? closeMenu() : openMenu(index()))}
                >
                  {group.label}
                </button>
                <Show when={openMenuIndex() === index()}>
                  <DropdownMenu
                    class="absolute top-full left-0 z-40 grid w-max min-w-[178px] p-[5px] border border-[var(--outline-soft)] rounded-md shadow-[0_14px_32px_rgb(0_0_0/34%)]"
                    style={{
                      "max-width": "min(280px, calc(100vw - 16px))",
                      background: "color-mix(in srgb, var(--surface) 96%, black)",
                    }}
                    aria-label={`${group.label} menu`}
                    onPointerEnter={() => openMenu(index())}
                    onPointerLeave={scheduleCloseMenu}
                  >
                    <For each={group.items}>
                      {(item) => (
                        <DropdownMenuItem
                          class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 w-full h-[26px] border-0 rounded bg-transparent text-[var(--text)] px-[7px] text-left whitespace-nowrap hover:bg-[var(--surface-high)] hover:shadow-none disabled:text-[color-mix(in_srgb,var(--text-muted)_55%,transparent)] [&_span]:overflow-hidden [&_span]:text-ellipsis"
                          disabled={item.disabled}
                          onClick={() => {
                            closeMenu();
                            runMenuItem(item);
                          }}
                        >
                          <span>{item.label}</span>
                          <Show when={item.shortcut}>
                            <kbd>{item.shortcut}</kbd>
                          </Show>
                        </DropdownMenuItem>
                      )}
                    </For>
                  </DropdownMenu>
                </Show>
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

      {/* RIGHT: reserved toolbar space */}
      <div class="flex items-center justify-end h-full min-w-0 overflow-hidden px-1.5">
      </div>
    </header>
  );
}
