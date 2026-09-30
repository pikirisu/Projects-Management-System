import { useEffect, useRef, useState } from "react";
import type {
    ButtonHTMLAttributes,
    RefObject,
    HTMLAttributes,
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
        "bg-indigo-600 text-white shadow-raised hover:bg-indigo-500 focus-visible:outline-indigo-600 disabled:bg-indigo-600/50",
    secondary:
        "bg-surface text-strong ring-1 ring-inset ring-hairline shadow-raised hover:bg-sunken focus-visible:outline-indigo-600",
    ghost: "text-muted hover:bg-sunken hover:text-strong focus-visible:outline-indigo-600",
    danger: "bg-red-600 text-white shadow-raised hover:bg-red-500 focus-visible:outline-red-600 disabled:bg-red-600/50",
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
                "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-ui",
                "focus-visible:outline-2 focus-visible:outline-offset-2",
                // A 1px drop on press. Small enough to read as the control
                // responding rather than as the layout moving.
                "active:translate-y-px",
                "disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:active:translate-y-0",
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
                className="block text-sm font-medium text-strong"
            >
                {label}
            </label>
            <input
                {...rest}
                id={inputId}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy}
                className={cx(
                    "block w-full rounded-lg px-3 py-2 text-sm transition-ui",
                    "bg-surface text-strong placeholder:text-faint",
                    "ring-1 ring-inset focus:ring-2 focus:ring-inset focus:outline-none",
                    error
                        ? "ring-red-500 focus:ring-red-500"
                        : "ring-hairline hover:ring-muted/40 focus:ring-indigo-600",
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
                <p id={`${inputId}-hint`} className="text-xs text-muted">
                    {hint}
                </p>
            ) : null}
        </div>
    );
}

/**
 * A compact unlabelled input, for a control that sits in a toolbar or at the
 * foot of a list rather than in a form.
 *
 * Its 200-character className was copy-pasted between the board's search box
 * and the task slide-over's add-subtask row. Two hand-rolled copies of the
 * shared input is how a design system stops being one: the next change lands on
 * whichever copy the author happened to open.
 */
export function InlineInput({
    className,
    ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...rest}
            className={cx(
                "block w-full rounded-lg px-3 py-1.5 text-sm transition-ui",
                "bg-surface text-strong placeholder:text-faint",
                "ring-1 ring-hairline ring-inset hover:ring-muted/40",
                "focus:ring-2 focus:ring-indigo-600 focus:ring-inset focus:outline-none",
                className,
            )}
        />
    );
}

/**
 * A labelled file picker. The same styling was written out three times -- the
 * new-task form, the task editor and the avatar picker -- and had already
 * drifted: two of the three styled the button text and the third did not.
 */
export function FileInput({
    label,
    hint,
    id,
    className,
    inputRef,
    ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    hint?: string;
    /** For clearing the picker: re-choosing the same file fires no change. */
    inputRef?: RefObject<HTMLInputElement | null>;
}) {
    const inputId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, "-");
    return (
        <div className="space-y-1.5">
            <label
                htmlFor={inputId}
                className="block text-sm font-medium text-strong"
            >
                {label}
            </label>
            <input
                {...rest}
                ref={inputRef}
                id={inputId}
                type="file"
                className={cx(
                    "block w-full text-sm text-muted",
                    "file:mr-3 file:cursor-pointer file:rounded-lg file:border-0",
                    "file:bg-sunken file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-strong",
                    "file:transition-ui hover:file:bg-hairline",
                    className,
                )}
            />
            {hint && <p className="text-xs text-muted">{hint}</p>}
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
                "rounded-lg px-3 py-2.5 text-sm ring-1 ring-inset",
                tone === "error"
                    ? "bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900"
                    : "bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900",
            )}
        >
            {children}
        </div>
    );
}

// Forwards the rest of the div props, the same way Button does, so a caller
// can make a card draggable or give it a handler without wrapping it in
// another element purely to hang the attribute on.
export function Card({
    className,
    children,
    ...rest
}: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            {...rest}
            className={cx(
                // border rather than ring: a ring sits outside the box and
                // doubles up wherever cards stack, which showed as a heavier
                // line between adjacent rows.
                "rounded-xl border border-hairline bg-surface shadow-raised",
                className,
            )}
        >
            {children}
        </div>
    );
}

const BADGE_TONES = {
    neutral: "bg-sunken text-muted",
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
                "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
                BADGE_TONES[tone],
            )}
        >
            {children}
        </span>
    );
}

/**
 * A loading placeholder shaped like the thing that is coming.
 *
 * A centred spinner says "something is happening"; a skeleton says "a list of
 * cards is happening, here is where they will be", so the layout does not jump
 * when the data lands.
 */
export function Skeleton({ className }: { className?: string }) {
    return (
        <div
            aria-hidden="true"
            className={cx("animate-pulse rounded-md bg-sunken", className)}
        />
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
        <div className="rounded-xl border border-dashed border-hairline bg-surface/40 px-6 py-14 text-center">
            <p className="text-heading text-strong">{title}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
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
                className="block text-sm font-medium text-strong"
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
                    "bg-surface text-strong placeholder:text-faint",
                    "ring-1 ring-inset focus:ring-2 focus:ring-inset focus:outline-none",
                    error
                        ? "ring-red-500 focus:ring-red-500"
                        : "ring-hairline hover:ring-muted/40 focus:ring-indigo-600",
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
                <p id={`${fieldId}-hint`} className="text-xs text-muted">
                    {hint}
                </p>
            ) : null}
        </div>
    );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    /** Borderless, for a control inside a card rather than inside a form. */
    quiet?: boolean;
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
    quiet = false,
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
                    className="block text-sm font-medium text-strong"
                >
                    {label}
                </label>
            )}
            <select
                {...rest}
                id={fieldId}
                aria-invalid={error ? true : undefined}
                className={cx(
                    "block w-full appearance-none rounded-lg text-sm transition-ui",
                    "text-strong focus:ring-2 focus:ring-inset focus:outline-none",
                    /*
                     * `quiet` is for a control that lives inside a card rather
                     * than inside a form. A full bordered field repeated on
                     * every card reads as a row of form inputs; this shows its
                     * affordance on hover and focus and stays out of the way in
                     * between.
                     */
                    quiet
                        ? "bg-transparent py-1 pr-7 pl-2 font-medium text-muted hover:bg-sunken hover:text-strong focus:ring-indigo-600"
                        : cx(
                              "bg-surface py-2 pr-8 pl-3 ring-1 ring-inset focus:ring-inset",
                              error
                                  ? "ring-red-500 focus:ring-red-500"
                                  : "ring-hairline hover:ring-muted/40 focus:ring-indigo-600",
                          ),
                    className,
                )}
                style={{
                    // A native select drops its arrow with appearance-none, so
                    // it is drawn back as a background image that follows
                    // currentColor in both themes.
                    backgroundImage:
                        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23888' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><path d='M4 6l4 4 4-4'/></svg>\")",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: `right ${quiet ? "0.375rem" : "0.625rem"} center`,
                    backgroundSize: "1rem",
                }}
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
    size?: "sm" | "md" | "lg";
}) {
    // "lg" is for the account screen, where the photo is the thing being
    // edited rather than a marker next to a name.
    const dimensions = {
        sm: "size-6 text-[10px]",
        md: "size-8 text-xs",
        lg: "size-14 text-base",
    }[size];
    const real = src && !PLACEHOLDER_AVATAR.test(src) ? src : null;

    if (real) {
        return (
            <img
                src={real}
                alt=""
                title={title}
                className={cx(
                    dimensions,
                    "shrink-0 rounded-full object-cover ring-1 ring-hairline",
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
                "bg-sunken text-muted ring-1 ring-hairline",
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
    /**
     * Names the button for assistive tech and for tests. A list of rows each
     * offering "Remove" gives a screen reader nothing to tell them apart, so
     * anywhere this button repeats, say what it acts on: "Remove attachment
     * spec.pdf".
     */
    describedAs,
    size = "sm",
    className,
}: {
    onConfirm: () => void;
    loading?: boolean;
    children?: ReactNode;
    confirmLabel?: string;
    describedAs?: string;
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
                aria-label={describedAs}
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
                aria-label={describedAs && `${confirmLabel}: ${describedAs}`}
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
                className="absolute inset-0 bg-neutral-950/50 backdrop-blur-[2px]"
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
                    "bg-surface shadow-overlay",
                )}
            >
                <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
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
            className="scrollbar-none flex gap-1 overflow-x-auto border-b border-hairline"
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
                            "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-ui",
                            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
                            active
                                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                                : "border-transparent text-muted hover:border-hairline hover:text-strong",
                        )}
                    >
                        {tab.label}
                        {tab.count !== undefined && (
                            /* A pill, not a loose number: at a glance the count
                             * belongs to its tab rather than floating between
                             * this label and the next one. */
                            <span
                                className={cx(
                                    "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums transition-ui",
                                    active
                                        ? "bg-indigo-600/10 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300"
                                        : "bg-sunken text-faint",
                                )}
                            >
                                {tab.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
