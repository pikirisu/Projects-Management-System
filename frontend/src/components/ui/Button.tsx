import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";
import { Spinner } from "./Feedback";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<ButtonVariant, string> = {
    primary:
        "bg-indigo-600 text-white shadow-raised hover:bg-indigo-500 focus-visible:outline-indigo-600",
    secondary:
        "bg-surface text-strong ring-1 ring-inset ring-hairline shadow-raised hover:bg-sunken focus-visible:outline-indigo-600",
    ghost: "text-muted hover:bg-sunken hover:text-strong focus-visible:outline-indigo-600",
    danger: "bg-red-600 text-white shadow-raised hover:bg-red-500 focus-visible:outline-red-600",
};

const SIZES = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-3.5 py-2 text-sm",
    icon: "size-8 text-sm",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: keyof typeof SIZES;
    loading?: boolean;
}

export function Button({
    variant = "primary",
    size = "md",
    loading = false,
    disabled,
    className,
    children,
    type = "button",
    ...rest
}: ButtonProps) {
    return (
        <button
            {...rest}
            type={type}
            disabled={disabled || loading}
            className={cx(
                "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition-ui",
                "focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px",
                "disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:active:translate-y-0",
                SIZES[size],
                VARIANTS[variant],
                className,
            )}
        >
            {loading && <Spinner className="size-3.5" />}
            {children}
        </button>
    );
}
