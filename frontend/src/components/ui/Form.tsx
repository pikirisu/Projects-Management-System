import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type {
    InputHTMLAttributes,
    ReactNode,
    RefObject,
    SelectHTMLAttributes,
    TextareaHTMLAttributes,
} from "react";
import { cx } from "./cx";

interface Labelled {
    label: string;
    error?: string;
    hint?: string;
}

/** aria-describedby for a control: its error when there is one, else its hint. */
const describedBy = (id: string, error?: string, hint?: string) =>
    error ? `${id}-error` : hint ? `${id}-hint` : undefined;

/**
 * The label, then the control, then its error or hint, wired for screen
 * readers. Every labelled control below is this plus its own element.
 */
function FieldShell({
    id,
    label,
    error,
    hint,
    children,
}: Partial<Labelled> & { id: string; children: ReactNode }) {
    return (
        <div className="space-y-1.5">
            {label && (
                <label
                    htmlFor={id}
                    className="block text-sm font-medium text-strong"
                >
                    {label}
                </label>
            )}
            {children}
            {error ? (
                <p
                    id={`${id}-error`}
                    className="text-xs text-red-600 dark:text-red-400"
                >
                    {error}
                </p>
            ) : hint ? (
                <p id={`${id}-hint`} className="text-xs text-muted">
                    {hint}
                </p>
            ) : null}
        </div>
    );
}

const control = (error?: string) =>
    cx(
        "block w-full rounded-lg bg-surface text-sm text-strong transition-ui placeholder:text-faint",
        "ring-1 ring-inset focus:ring-2 focus:ring-inset focus:outline-none",
        error
            ? "ring-red-500 focus:ring-red-500"
            : "ring-hairline hover:ring-muted/40 focus:ring-indigo-600",
    );

export function Field({
    label,
    error,
    hint,
    id,
    className,
    ...rest
}: InputHTMLAttributes<HTMLInputElement> & Labelled) {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
        <FieldShell id={inputId} label={label} error={error} hint={hint}>
            <input
                {...rest}
                id={inputId}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy(inputId, error, hint)}
                className={cx(control(error), "px-3 py-2", className)}
            />
        </FieldShell>
    );
}

/**
 * A password input with a button that reveals what was typed. The button's
 * name stays fixed and aria-pressed carries the state, which is how a screen
 * reader announces a toggle.
 */
export function PasswordField({
    label,
    error,
    hint,
    id,
    className,
    ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & Labelled) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const [visible, setVisible] = useState(false);
    const Icon = visible ? EyeOff : Eye;

    return (
        <FieldShell id={inputId} label={label} error={error} hint={hint}>
            <div className="relative">
                <input
                    {...rest}
                    id={inputId}
                    type={visible ? "text" : "password"}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy(inputId, error, hint)}
                    className={cx(control(error), "py-2 pr-10 pl-3", className)}
                />
                <button
                    type="button"
                    aria-label="Show password"
                    aria-pressed={visible}
                    title={visible ? "Hide password" : "Show password"}
                    onClick={() => setVisible((shown) => !shown)}
                    className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-faint transition-ui hover:text-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600"
                >
                    <Icon className="size-4" aria-hidden="true" />
                </button>
            </div>
        </FieldShell>
    );
}

export function Textarea({
    label,
    error,
    hint,
    id,
    className,
    ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & Labelled) {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
        <FieldShell id={inputId} label={label} error={error} hint={hint}>
            <textarea
                {...rest}
                id={inputId}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy(inputId, error, hint)}
                className={cx(control(error), "px-3 py-2", className)}
            />
        </FieldShell>
    );
}

/** A compact unlabelled input for toolbars and inline rows. */
export function InlineInput({
    className,
    ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input {...rest} className={cx(control(), "px-3 py-1.5", className)} />
    );
}

// A native select loses its arrow with appearance-none, so one is drawn back.
const SELECT_ARROW =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23888' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><path d='M4 6l4 4 4-4'/></svg>\")";

export function Select({
    label,
    error,
    hint,
    options,
    id,
    className,
    quiet = false,
    ...rest
}: SelectHTMLAttributes<HTMLSelectElement> &
    Partial<Labelled> & {
        options: Array<{ value: string; label: string }>;
        /** Borderless until hovered, for a control inside a card. */
        quiet?: boolean;
    }) {
    const autoId = useId();
    const selectId = id ?? autoId;
    return (
        <FieldShell id={selectId} label={label} error={error} hint={hint}>
            <select
                {...rest}
                id={selectId}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy(selectId, error, hint)}
                className={cx(
                    "appearance-none",
                    quiet
                        ? "block w-full rounded-lg bg-transparent py-1 pr-7 pl-2 text-xs font-medium text-muted transition-ui hover:bg-sunken hover:text-strong focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                        : cx(control(error), "py-2 pr-8 pl-3"),
                    className,
                )}
                style={{
                    backgroundImage: SELECT_ARROW,
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
        </FieldShell>
    );
}

export function FileInput({
    label,
    hint,
    id,
    className,
    inputRef,
    ...rest
}: InputHTMLAttributes<HTMLInputElement> &
    Omit<Labelled, "error"> & {
        /** For clearing the picker: choosing the same file again fires no change. */
        inputRef?: RefObject<HTMLInputElement | null>;
    }) {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
        <FieldShell id={inputId} label={label} hint={hint}>
            <input
                {...rest}
                ref={inputRef}
                id={inputId}
                type="file"
                aria-describedby={describedBy(inputId, undefined, hint)}
                className={cx(
                    "block w-full text-sm text-muted",
                    "file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-sunken",
                    "file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-strong file:transition-ui hover:file:bg-hairline",
                    className,
                )}
            />
        </FieldShell>
    );
}
