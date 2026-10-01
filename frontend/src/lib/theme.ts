import { useSyncExternalStore } from "react";

export type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

// index.html reads the same key before first paint, so there is no flash.
const STORAGE_KEY = "project-camp.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readPreference(): ThemePreference {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        return stored === "light" || stored === "dark" ? stored : "system";
    } catch {
        return "system";
    }
}

// One store for the whole app, so every toggle (and the toasts) agree.
const listeners = new Set<() => void>();
let preference = readPreference();
let resolved: ResolvedTheme = "light";

function apply() {
    const systemDark = window.matchMedia?.(DARK_QUERY).matches ?? false;
    resolved =
        preference === "dark" || (preference === "system" && systemDark)
            ? "dark"
            : "light";
    document.documentElement.dataset.theme = resolved;
    for (const listener of listeners) listener();
}

apply();
// Following the system means following it when it changes, too.
window.matchMedia?.(DARK_QUERY).addEventListener?.("change", apply);

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function setThemePreference(next: ThemePreference) {
    preference = next;
    try {
        if (next === "system") window.localStorage.removeItem(STORAGE_KEY);
        else window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
        /* the choice just will not survive a reload */
    }
    apply();
}

export const useThemePreference = () =>
    useSyncExternalStore(subscribe, () => preference);

export const useResolvedTheme = () =>
    useSyncExternalStore(subscribe, () => resolved);
