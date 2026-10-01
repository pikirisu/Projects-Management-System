import type { User, UserRef } from "./types";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
});

export function formatDate(value?: string) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : dateFormatter.format(parsed);
}

/** A populated reference, or null for a bare id or nothing. */
export function asUser(ref: UserRef): User | null {
    return ref && typeof ref === "object" ? ref : null;
}

/** The id of a reference, populated or not. */
export function refId(ref: UserRef): string | null {
    if (!ref) return null;
    return typeof ref === "string" ? ref : ref._id;
}

export function displayName(user: User | null): string {
    if (!user) return "Unassigned";
    return user.fullName?.trim() || user.username;
}

/** Up to two initials, for the avatar fallback. */
export function initials(user: User | null): string {
    const parts = (user ? displayName(user) : "").split(/\s+/).filter(Boolean);
    const first = parts[0];
    const last = parts.at(-1);
    if (!first || !last) return "?";
    if (parts.length === 1) return first.slice(0, 2).toUpperCase();
    return (first[0]! + last[0]!).toUpperCase();
}

const UNITS = ["B", "KB", "MB", "GB"];

export function formatBytes(bytes?: number): string | null {
    if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) {
        return null;
    }
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < UNITS.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${UNITS[unit]}`;
}

/** Last path segment of an attachment URL, used as its display name. */
export function attachmentName(url: string): string {
    try {
        const path = new URL(url, window.location.origin).pathname;
        return decodeURIComponent(path.split("/").filter(Boolean).pop() ?? url);
    } catch {
        return url;
    }
}

/** A stable colour per project, so it is recognisable across screens. */
export function projectColor(id: string): string {
    let hash = 0;
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return `oklch(65% 0.15 ${hash % 360})`;
}

// ---- due dates ---------------------------------------------------------------

const DAY_MS = 86_400_000;

const dayFormatter = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
});

export type DueTone = "overdue" | "today" | "soon" | "later";

export interface DueStatus {
    /** Whole days from today; negative once overdue. */
    days: number;
    tone: DueTone;
    label: string;
}

// Decision: a due date is a calendar day, not an instant. It is stored as UTC
// midnight, so it is compared and formatted in UTC; formatting it in local time
// would show "2 Oct" for a 3 Oct deadline anywhere west of Greenwich.
export function dueStatus(
    dueDate: string | null | undefined,
    now = new Date(),
): DueStatus | null {
    if (!dueDate) return null;
    const due = Date.parse(dueDate.slice(0, 10));
    if (Number.isNaN(due)) return null;

    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((due - today) / DAY_MS);
    const day = dayFormatter.format(due);

    if (days < 0) return { days, tone: "overdue", label: `Overdue · ${day}` };
    if (days === 0) return { days, tone: "today", label: "Due today" };
    if (days === 1) return { days, tone: "soon", label: "Due tomorrow" };
    return { days, tone: days <= 7 ? "soon" : "later", label: `Due ${day}` };
}

/** The value an <input type="date"> takes for a stored due date. */
export const toDateInput = (dueDate?: string | null) =>
    dueDate ? dueDate.slice(0, 10) : "";
