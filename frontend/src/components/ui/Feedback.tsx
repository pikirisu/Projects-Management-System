import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

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
                    : "bg-indigo-50 text-indigo-900 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:ring-indigo-900",
            )}
        >
            {children}
        </div>
    );
}

/** Forwards div props so a card can be draggable or carry handlers. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            {...rest}
            className={cx(
                "rounded-xl border border-hairline bg-surface shadow-raised",
                className,
            )}
        />
    );
}

const BADGE_TONES = {
    neutral: "bg-sunken text-muted",
    accent: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
    danger: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    warning:
        "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    success:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
};

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
    tone = "neutral",
    className,
    children,
}: {
    tone?: BadgeTone;
    className?: string;
    children: ReactNode;
}) {
    return (
        <span
            className={cx(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
                BADGE_TONES[tone],
                className,
            )}
        >
            {children}
        </span>
    );
}

/** A placeholder shaped like what is loading, so nothing jumps when it lands. */
export function Skeleton({ className }: { className?: string }) {
    return (
        <div
            aria-hidden="true"
            className={cx("animate-pulse rounded-md bg-sunken", className)}
        />
    );
}

export function EmptyState({
    icon,
    title,
    description,
    action,
}: {
    icon?: ReactNode;
    title: string;
    description: string;
    action?: ReactNode;
}) {
    return (
        <div className="rounded-xl border border-dashed border-hairline px-6 py-14 text-center">
            {icon && (
                <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-sunken text-muted">
                    {icon}
                </div>
            )}
            <p className="text-heading text-strong">{title}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                {description}
            </p>
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

/** Title, description and an optional action, at the top of every page. */
export function PageHeader({
    title,
    description,
    action,
}: {
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
                <h1 className="text-display text-strong">{title}</h1>
                {description && (
                    <p className="mt-1 text-sm text-muted">{description}</p>
                )}
            </div>
            {action}
        </div>
    );
}
