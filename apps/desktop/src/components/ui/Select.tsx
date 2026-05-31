import type { JSX } from "solid-js";
import { cn } from "../../lib/utils";

export type SelectProps = JSX.SelectHTMLAttributes<HTMLSelectElement>;

export function Select(props: SelectProps) {
  const { class: className, ...rest } = props;

  return (
    <select
      class={cn(
        "flex h-7 w-full min-w-0 rounded-md border border-[var(--outline-soft)] bg-[var(--surface-lowest)] px-2.5 text-xs leading-[18px] text-[var(--text)] outline-none transition-colors focus:border-[var(--primary-strong)] focus:shadow-[0_0_0_1px_var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-55",
        className,
      )}
      {...rest}
    />
  );
}

export function SelectOption(props: JSX.OptionHTMLAttributes<HTMLOptionElement>) {
  return <option {...props} />;
}
