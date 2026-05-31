import type { JSX } from "solid-js";
import { cn } from "../../lib/utils";

export function DropdownMenu(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const { class: className, ...rest } = props;
  return (
    <div
      class={cn(
        "z-50 grid min-w-[176px] overflow-hidden rounded-md border border-[var(--outline-soft)] bg-[color-mix(in_srgb,var(--surface)_96%,black)] p-1 shadow-[0_18px_42px_rgb(0_0_0_/_38%)]",
        className,
      )}
      role="menu"
      {...rest}
    />
  );
}

export function DropdownMenuLabel(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const { class: className, ...rest } = props;
  return (
    <div
      class={cn(
        "overflow-hidden border-b border-[color-mix(in_srgb,var(--outline-soft)_60%,transparent)] px-2 pb-1.5 pt-1 text-ellipsis whitespace-nowrap text-[10px] font-semibold uppercase leading-4 tracking-[0.02em] text-[var(--text-muted)]",
        className,
      )}
      {...rest}
    />
  );
}

export function DropdownMenuItem(props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & { inset?: boolean; destructive?: boolean }) {
  const { class: className, inset, destructive, ...rest } = props;
  return (
    <button
      class={cn(
        "flex h-6 w-full min-w-0 items-center gap-2 rounded border-0 bg-transparent px-2 text-left text-xs leading-[18px] text-[var(--text)] outline-none transition-colors hover:bg-[var(--surface-high)] focus-visible:bg-[var(--surface-high)] focus-visible:shadow-none disabled:pointer-events-none disabled:text-[color-mix(in_srgb,var(--text-muted)_48%,transparent)]",
        inset && "pl-7",
        destructive && "text-[var(--error)]",
        className,
      )}
      role="menuitem"
      type="button"
      {...rest}
    />
  );
}

export function DropdownMenuSeparator(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const { class: className, ...rest } = props;
  return <div class={cn("-mx-1 my-1 h-px bg-[color-mix(in_srgb,var(--outline-soft)_60%,transparent)]", className)} role="separator" {...rest} />;
}
