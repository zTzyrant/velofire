import type { JSX } from "solid-js";
import { cn } from "../../lib/utils";

export function Drawer(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const { class: className, ...rest } = props;
  return <div class={cn("fixed inset-0 z-20 pointer-events-none", className)} {...rest} />;
}

export function DrawerTrigger(props: JSX.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { class: className, ...rest } = props;
  return (
    <button
      class={cn(
        "pointer-events-auto h-7 rounded-t-md border border-b-0 border-[var(--outline-soft)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-high)] hover:text-[var(--text)] hover:shadow-none",
        className,
      )}
      type="button"
      {...rest}
    />
  );
}

export function DrawerContent(props: JSX.HTMLAttributes<HTMLElement>) {
  const { class: className, ...rest } = props;
  return (
    <section
      class={cn(
        "pointer-events-auto absolute inset-x-0 bottom-0 border-t border-[var(--outline-soft)] bg-[color-mix(in_srgb,var(--surface-lowest)_96%,black)] shadow-[0_-18px_42px_rgb(0_0_0/38%)]",
        className,
      )}
      {...rest}
    />
  );
}

export function DrawerHeader(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const { class: className, ...rest } = props;
  return (
    <div
      class={cn("flex h-8 items-center justify-between border-b border-[var(--outline-soft)] px-3", className)}
      {...rest}
    />
  );
}
