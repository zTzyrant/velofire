import type { JSX } from "solid-js";
import { cn } from "../../lib/utils";

export function DialogBackdrop(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const { class: className, ...rest } = props;
  return (
    <div
      class={cn(
        "fixed inset-0 z-[35] grid place-items-center bg-[color-mix(in_srgb,var(--surface-lowest)_58%,transparent)] p-4",
        className,
      )}
      {...rest}
    />
  );
}

export function DialogContent(props: JSX.HTMLAttributes<HTMLElement>) {
  const { class: className, ...rest } = props;
  return (
    <section
      class={cn(
        "grid w-[min(448px,calc(100vw-32px))] min-w-0 gap-3.5 rounded-lg border border-[var(--outline-soft)] bg-[color-mix(in_srgb,var(--surface)_96%,black)] p-4 shadow-[0_20px_54px_rgb(0_0_0_/_42%)]",
        className,
      )}
      {...rest}
    />
  );
}

export function DialogHeader(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const { class: className, ...rest } = props;
  return <div class={cn("flex min-w-0 items-center justify-between gap-3", className)} {...rest} />;
}

export function DialogTitle(props: JSX.HTMLAttributes<HTMLHeadingElement>) {
  const { class: className, ...rest } = props;
  return (
    <h2
      class={cn("m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[15px] leading-[22px] text-[var(--text)]", className)}
      {...rest}
    />
  );
}

export function DialogDescription(props: JSX.HTMLAttributes<HTMLParagraphElement>) {
  const { class: className, ...rest } = props;
  return <p class={cn("m-0 text-xs leading-[18px] text-[var(--text-muted)]", className)} {...rest} />;
}

export function DialogActions(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const { class: className, ...rest } = props;
  return <div class={cn("flex justify-end gap-2", className)} {...rest} />;
}
