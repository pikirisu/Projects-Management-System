import { useEffect, useRef, useState } from "react";
import type {
    ButtonHTMLAttributes,
    InputHTMLAttributes,
    ReactNode,
    SelectHTMLAttributes,
    TextareaHTMLAttributes,
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

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label: string;
    error?: string;
    hint?: string;
}

export function Textarea({
    label,
    error,
    hint,
    id,
    className,
    ...rest
}: TextareaProps) {
    const fieldId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, "-");
    const describedBy = error
        ? `${fieldId}-error`
        : hint
          ? `${fieldId}-hint`
          : undefined;

    return (
        <div className="space-y-1.5">
            <label
                htmlFor={fieldId}
                className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
                {label}
            </label>
            <textarea
                {...rest}
                id={fieldId}
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
                    id={`${fieldId}-error`}
                    className="text-xs text-red-600 dark:text-red-400"
                >
                    {error}
                </p>
            ) : hint ? (
                <p
                    id={`${fieldId}-hint`}
                    className="text-xs text-neutral-500 dark:text-neutral-400"
                >
                    {hint}
                </p>
            ) : null}
        </div>
    );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: Array<{ value: string; label: string }>;
}

export function Select({
    label,
    error,
    options,
    id,
    className,
    ...rest
}: SelectProps) {
    const fieldId =
        id ??
        rest.name ??
        label?.toLowerCase().replace(/\s+/g, "-") ??
        "select";

    return (
        <div className="space-y-1.5">
            {label && (
                <label
                    htmlFor={fieldId}
                    className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                >
                    {label}
                </label>
            )}
            <select
                {...rest}
                id={fieldId}
                aria-invalid={error ? true : undefined}
                className={cx(
                    "block w-full rounded-md py-2 pr-8 pl-3 text-sm",
                    "bg-white text-neutral-900",
                    "ring-1 ring-inset focus:ring-2 focus:ring-inset focus:outline-none",
                    "dark:bg-neutral-900 dark:text-neutral-100",
                    error
                        ? "ring-red-500 focus:ring-red-500"
                        : "ring-neutral-300 focus:ring-indigo-600 dark:ring-neutral-700",
                    className,
                )}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {error && (
                <p className="text-xs text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}
        </div>
    );
}

/*
 * The API seeds every account with the same placehold.co URL, so honouring it
 * would mean one external request per member to render an identical grey box.
 * Initials are faster, work offline, and actually identify the person.
 */
const PLACEHOLDER_AVATAR = /placehold\.co/i;

export function Avatar({
    src,
    initials,
    title,
    size = "md",
}: {
    src?: string;
    initials: string;
    title?: string;
    size?: "sm" | "md";
}) {
    const dimensions = size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs";
    const real = src && !PLACEHOLDER_AVATAR.test(src) ? src : null;

    if (real) {
        return (
            <img
                src={real}
                alt=""
                title={title}
                className={cx(
                    dimensions,
                    "shrink-0 rounded-full object-cover ring-1 ring-neutral-200 dark:ring-neutral-700",
                )}
            />
        );
    }

    return (
        <span
            title={title}
            aria-hidden="true"
            className={cx(
                dimensions,
                "grid shrink-0 place-items-center rounded-full font-semibold",
                "bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-200",
            )}
        >
            {initials}
        </span>
    );
}

/**
 * Two-step destructive action. A native confirm() would do the same job, but it
 * blocks the event loop, cannot be styled, and is suppressed outright in some
 * embedded browsers -- which would silently make deletion impossible there.
 */
export function ConfirmButton({
    onConfirm,
    loading = false,
    children = "Delete",
    confirmLabel = "Confirm",
    size = "sm",
    className,
}: {
    onConfirm: () => void;
    loading?: boolean;
    children?: ReactNode;
    confirmLabel?: string;
    size?: "sm" | "md";
    className?: string;
}) {
    const [armed, setArmed] = useState(false);

    // Disarms itself so a half-pressed delete never lingers on screen.
    useEffect(() => {
        if (!armed) return;
        const timer = window.setTimeout(() => setArmed(false), 4000);
        return () => window.clearTimeout(timer);
    }, [armed]);

    if (!armed) {
        return (
            <Button
                variant="ghost"
                size={size}
                className={cx("text-red-600 dark:text-red-400", className)}
                onClick={() => setArmed(true)}
            >
                {children}
            </Button>
        );
    }

    return (
        <span className="inline-flex items-center gap-1">
            <Button
                variant="danger"
                size={size}
                loading={loading}
                onClick={() => {
                    setArmed(false);
                    onConfirm();
                }}
            >
                {confirmLabel}
            </Button>
            <Button variant="ghost" size={size} onClick={() => setArmed(false)}>
                Cancel
            </Button>
        </span>
    );
}

/**
 * Right-hand slide-over. Focus moves into the panel on open and Escape closes
 * it, so the whole thing stays reachable from the keyboard.
 */
export function SlideOver({
    open,
    onClose,
    title,
    children,
}: {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
}) {
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
        }
        document.addEventListener("keydown", onKeyDown);
        panelRef.current?.focus();

        // The backdrop covers the page; letting it scroll underneath is
        // disorienting, especially on touch.
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div
                className="absolute inset-0 bg-neutral-900/40"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                className={cx(
                    "relative flex h-full w-full max-w-lg flex-col shadow-xl outline-none",
                    "bg-white dark:bg-neutral-900",
                )}
            >
                <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                    <div className="min-w-0 flex-1">{title}</div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        aria-label="Close panel"
                    >
                        Close
                    </Button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4">
                    {children}
                </div>
            </div>
        </div>
    );
}

/** Horizontal tab strip driven by a controlled value. */
export function Tabs<T extends string>({
    value,
    onChange,
    tabs,
}: {
    value: T;
    onChange: (next: T) => void;
    tabs: Array<{ value: T; label: string; count?: number }>;
}) {
    return (
        <div
            role="tablist"
            className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800"
        >
            {tabs.map((tab) => {
                const active = tab.value === value;
                return (
                    <button
                        key={tab.value}
                        role="tab"
                        type="button"
                        aria-selected={active}
                        onClick={() => onChange(tab.value)}
                        className={cx(
                            "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
                            active
                                ? "border-indigo-600 text-indigo-700 dark:text-indigo-400"
                                : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100",
                        )}
                    >
                        {tab.label}
                        {tab.count !== undefined && (
                            <span className="ml-1.5 text-xs text-neutral-400">
                                {tab.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
