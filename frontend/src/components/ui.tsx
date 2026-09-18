import type {
    ButtonHTMLAttributes,
    InputHTMLAttributes,
    ReactNode,
} from "react";

/** Tiny classnames joiner; avoids a dependency for something this small. */
export function cx(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
    primary:
        "bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600 disabled:bg-indigo-600/50",
    secondary:
        "bg-white text-neutral-800 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 focus-visible:outline-neutral-400 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700 dark:hover:bg-neutral-800",
    ghost: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100",
    danger: "bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600 disabled:bg-red-600/50",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: "sm" | "md";
    loading?: boolean;
}

export function Button({
    variant = "primary",
    size = "md",
    loading = false,
    disabled,
    className,
    children,
    ...rest
}: ButtonProps) {
    return (
        <button
            {...rest}
            disabled={disabled || loading}
            className={cx(
                "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-70",
                size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
                BUTTON_VARIANTS[variant],
                className,
            )}
        >
            {loading && <Spinner className="size-3.5" />}
            {children}
        </button>
    );
}

export function Spinner({ className }: { className?: string }) {
    return (
        <svg
            className={cx("animate-spin", className ?? "size-4")}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
        >
            <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
            />
            <path
                className="opacity-90"
                fill="currentColor"
                d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
            />
        </svg>
    );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    hint?: string;
}

export function Field({
    label,
    error,
    hint,
    id,
    className,
    ...rest
}: FieldProps) {
    const inputId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, "-");
    const describedBy = error
        ? `${inputId}-error`
        : hint
          ? `${inputId}-hint`
          : undefined;

    return (
        <div className="space-y-1.5">
            <label
                htmlFor={inputId}
                className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
                {label}
            </label>
            <input
                {...rest}
                id={inputId}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy}
                className={cx(
                    "block w-full rounded-md px-3 py-2 text-sm",
                    "bg-white text-neutral-900 placeholder:text-neutral-400",
                    "ring-1 ring-inset focus:ring-2 focus:ring-inset focus:outline-none",
                    "dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-600",
                    error
                        ? "ring-red-500 focus:ring-red-500"
                        : "ring-neutral-300 focus:ring-indigo-600 dark:ring-neutral-700",
                    className,
                )}
            />
            {error ? (
                <p
                    id={`${inputId}-error`}
                    className="text-xs text-red-600 dark:text-red-400"
                >
                    {error}
                </p>
            ) : hint ? (
                <p
                    id={`${inputId}-hint`}
                    className="text-xs text-neutral-500 dark:text-neutral-400"
                >
                    {hint}
                </p>
            ) : null}
        </div>
    );
}

export function Alert({
    tone = "error",
    children,
}: {
    tone?: "error" | "info";
    children: ReactNode;
}) {
    return (
        <div
            role={tone === "error" ? "alert" : "status"}
            className={cx(
                "rounded-md px-3 py-2 text-sm ring-1 ring-inset",
                tone === "error"
                    ? "bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900"
                    : "bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900",
            )}
        >
            {children}
        </div>
    );
}

export function Card({
    className,
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    return (
        <div
            className={cx(
                "rounded-lg bg-white ring-1 ring-neutral-200",
                "dark:bg-neutral-900 dark:ring-neutral-800",
                className,
            )}
        >
            {children}
        </div>
    );
}

const BADGE_TONES = {
    neutral:
        "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
    accent: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
};

export function Badge({
    tone = "neutral",
    children,
}: {
    tone?: keyof typeof BADGE_TONES;
    children: ReactNode;
}) {
    return (
        <span
            className={cx(
                "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium",
                BADGE_TONES[tone],
            )}
        >
            {children}
        </span>
    );
}

export function EmptyState({
    title,
    description,
    action,
}: {
    title: string;
    description: string;
    action?: ReactNode;
}) {
    return (
        <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-12 text-center dark:border-neutral-700">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {title}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
                {description}
            </p>
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
