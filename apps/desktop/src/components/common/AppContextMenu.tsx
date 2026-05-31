import { Show, For } from "solid-js";
import { cn } from "../../lib/utils";
import {
  ContextMenuContent,
  ContextMenuItem as ContextMenuPrimitiveItem,
  ContextMenuLabel,
} from "../ui/ContextMenu";

export type ContextMenuItem = {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  run: () => void | Promise<void>;
};

export type ContextMenuState = {
  x: number;
  y: number;
  title: string;
  items: ContextMenuItem[];
};

type Props = {
  state: ContextMenuState | null;
  onRunItem: (item: ContextMenuItem) => void;
};

export function AppContextMenu(props: Props) {
  return (
    <Show when={props.state}>
      {(menu) => (
        <ContextMenuContent
          role="menu"
          class="fixed"
          aria-label={menu().title}
          style={{ left: `${menu().x}px`, top: `${menu().y}px`, "z-index": 9999 }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <ContextMenuLabel class="text-xs text-[var(--text-muted)] font-medium px-2 py-1.5 select-none">
            {menu().title}
          </ContextMenuLabel>
          <For each={menu().items}>
            {(item) => (
              <ContextMenuPrimitiveItem
                class={cn(
                  "px-2 py-1.5 text-sm cursor-pointer outline-none",
                  item.danger ? "text-[var(--error)] hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]" : "text-[var(--text)] hover:bg-[var(--surface-high)]",
                  item.disabled ? "opacity-40 pointer-events-none" : "",
                )}
                destructive={item.danger}
                disabled={item.disabled}
                onClick={() => props.onRunItem(item)}
              >
                {item.label}
              </ContextMenuPrimitiveItem>
            )}
          </For>
        </ContextMenuContent>
      )}
    </Show>
  );
}
