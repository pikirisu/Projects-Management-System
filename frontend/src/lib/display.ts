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

/**
 * Reference fields arrive either populated or as a bare id string depending on
 * which endpoint produced them (see the UserRef comment in ./types.ts). Only
 * the populated form can be rendered, so everything else collapses to null.
 */
export function asUser(ref: UserRef): User | null {
    return ref && typeof ref === "object" ? ref : null;
}

/** The id of a reference, populated or not -- useful for equality checks. */
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
    const name = user ? displayName(user) : "?";
    // tsconfig has noUncheckedIndexedAccess, so every index access is a maybe.
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0];
    const last = parts[parts.length - 1];
    if (!first || !last) return "?";
    if (parts.length === 1) return first.slice(0, 2).toUpperCase();
    return (first.slice(0, 1) + last.slice(0, 1)).toUpperCase();
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
