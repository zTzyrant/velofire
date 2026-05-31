import type { JSX } from "solid-js";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex h-7 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-[11px] font-medium outline-none transition-colors focus-visible:border-[var(--primary-strong)] focus-visible:shadow-[0_0_0_1px_var(--primary-strong)] disabled:pointer-events-none disabled:opacity-55",
  {
    variants: {
      variant: {
        default: "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-ink)] hover:bg-[color-mix(in_srgb,var(--primary)_86%,white)]",
        secondary: "border-[var(--outline-soft)] bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-high)] hover:text-[var(--text)]",
        destructive: "border-[color-mix(in_srgb,var(--error)_68%,transparent)] bg-[color-mix(in_srgb,var(--error)_22%,var(--surface))] text-[var(--error)] hover:bg-[color-mix(in_srgb,var(--error)_30%,var(--surface-high))]",
        ghost: "border-transparent bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-high)] hover:text-[var(--text)]",
        link: "h-auto border-transparent bg-transparent px-0 text-[var(--primary)] underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-6 px-2 text-[11px]",
        md: "h-7 px-3",
        lg: "h-8 px-4 text-xs",
        icon: "h-7 w-7 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export { buttonVariants };

type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button(props: ButtonProps) {
  const { class: className, variant, size, ...rest } = props;
  return <button class={cn(buttonVariants({ variant, size }), className)} {...rest} />;
}
