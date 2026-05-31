import type { JSX } from "solid-js";
import { cn } from "../../lib/utils";

export function Tabs(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const { class: className, ...rest } = props;
  return <div class={cn("grid min-w-0 gap-2", className)} {...rest} />;
}

export function TabsList(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const { class: className, ...rest } = props;
  return (
    <div
      class={cn(
        "inline-flex h-8 min-w-0 items-center gap-1 rounded-md border border-[var(--outline-soft)] bg-[var(--surface-lowest)] p-1",
        className,
      )}
      role="tablist"
      {...rest}
    />
  );
}

export function TabsTrigger(props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  const { class: className, selected, ...rest } = props;
  return (
    <button
      class={cn(
        "inline-flex h-6 min-w-0 items-center justify-center rounded px-2.5 text-[11px] font-medium text-[var(--text-muted)] outline-none transition-colors hover:bg-[var(--surface-high)] hover:text-[var(--text)] focus-visible:border-[var(--primary-strong)] focus-visible:shadow-[0_0_0_1px_var(--primary-strong)] disabled:pointer-events-none disabled:opacity-55",
        selected && "bg-[var(--surface-high)] text-[var(--text)]",
        className,
      )}
      role="tab"
      aria-selected={selected}
      type="button"
      {...rest}
    />
  );
}

export function TabsContent(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const { class: className, ...rest } = props;
  return <div class={cn("min-w-0 outline-none", className)} role="tabpanel" {...rest} />;
}
