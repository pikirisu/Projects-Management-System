import type { ApiEnvelope, AuthPayload } from "./types";

const BASE_URL = (
    import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1"
).replace(/\/+$/, "");

// Decision: Bearer tokens, not cookies. The client and API are deployed on
// different sites, where cookies would need SameSite=None, which Safari and
// Chrome's third-party-cookie protections block. The access token lives in
// memory only; the refresh token survives a reload in localStorage, accepting
// that script on this origin could read it.
let accessToken: string | null = null;

const REFRESH_STORAGE_KEY = "project-camp.refreshToken";

/** Storage throws in some privacy modes; that must never break a render. */
const safeStorage = {
    get(key: string): string | null {
        try {
            return window.localStorage.getItem(key);
        } catch {
            return null;
        }
    },
    set(key: string, value: string | null) {
        try {
            if (value === null) window.localStorage.removeItem(key);
            else window.localStorage.setItem(key, value);
        } catch {
            /* ignore */
        }
    },
};

export const getAccessToken = () => accessToken;
export const getRefreshToken = () => safeStorage.get(REFRESH_STORAGE_KEY);

export function setTokens(tokens: {
    accessToken: string;
    refreshToken: string;
}) {
    accessToken = tokens.accessToken;
    safeStorage.set(REFRESH_STORAGE_KEY, tokens.refreshToken);
}

export function clearTokens() {
    accessToken = null;
    safeStorage.set(REFRESH_STORAGE_KEY, null);
}

export class ApiError extends Error {
    readonly status: number;
    /** field name -> message, flattened from the API's `errors` array. */
    readonly fieldErrors: Record<string, string>;

    constructor(
        status: number,
        message: string,
        fieldErrors: Record<string, string> = {},
    ) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.fieldErrors = fieldErrors;
    }

    /** True when the request never reached the server at all. */
    get isNetworkError() {
        return this.status === 0;
    }
}

/** The ApiError inside `error`, or null for anything else. */
export const asApiError = (error: unknown) =>
    error instanceof ApiError ? error : null;

/** A message fit to show: the server's own, or `fallback`. */
export const errorMessage = (error: unknown, fallback: string) =>
    asApiError(error)?.message ?? fallback;

function toFieldErrors(
    errors: Array<Record<string, string>> | undefined,
): Record<string, string> {
    return Object.assign({}, ...(errors ?? []));
}

// A session can end while the app is open (a password changed elsewhere, or a
// refresh token expiring). The client is where that is discovered and only
// React can act on it, so the auth context subscribes here.
const sessionLostListeners = new Set<() => void>();

export function onSessionLost(listener: () => void) {
    sessionLostListeners.add(listener);
    return () => {
        sessionLostListeners.delete(listener);
    };
}

// Decision: refresh is single-flight. Several queries can 401 at once after a
// reload, and the API rotates the refresh token on every use, so parallel
// refreshes would spend the same token twice and sign the user out.
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
    refreshInFlight ??= (async () => {
        const refreshToken = getRefreshToken();
        if (!refreshToken) return false;

        try {
            const response = await fetch(`${BASE_URL}/auth/refresh-token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken }),
            });
            if (!response.ok) {
                // The server refused the token itself: this session is over.
                clearTokens();
                for (const listener of sessionLostListeners) listener();
                return false;
            }
            const envelope =
                (await response.json()) as ApiEnvelope<AuthPayload>;
            setTokens(envelope.data);
            return true;
        } catch {
            // A dropped connection is not an expired session; keep the tokens
            // so the next request can try again.
            return false;
        }
    })().finally(() => {
        refreshInFlight = null;
    });
    return refreshInFlight;
}

interface RequestOptions {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    /** A plain object is sent as JSON; FormData is passed through. */
    body?: unknown;
    /** Internal: stops a refresh loop. */
    skipAuthRetry?: boolean;
}

export async function request<T>(
    path: string,
    options: RequestOptions = {},
): Promise<T> {
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    let body: BodyInit | undefined;
    if (options.body instanceof FormData) {
        // No Content-Type: the browser sets it, with the multipart boundary.
        body = options.body;
    } else if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
        response = await fetch(`${BASE_URL}${path}`, {
            method: options.method ?? "GET",
            headers,
            body,
        });
    } catch {
        throw new ApiError(
            0,
            "Could not reach the server. Check your connection and try again.",
        );
    }

    if (response.status === 401 && !options.skipAuthRetry) {
        if (await refreshSession()) {
            return request<T>(path, { ...options, skipAuthRetry: true });
        }
    }

    const envelope = (await response
        .json()
        .catch(() => null)) as ApiEnvelope<T> | null;

    if (!response.ok || !envelope) {
        throw new ApiError(
            response.status,
            envelope?.message ?? `Request failed (${response.status})`,
            toFieldErrors(envelope?.errors),
        );
    }

    return envelope.data;
}

export const api = {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) =>
        request<T>(path, { method: "POST", body }),
    put: <T>(path: string, body?: unknown) =>
        request<T>(path, { method: "PUT", body }),
    patch: <T>(path: string, body?: unknown) =>
        request<T>(path, { method: "PATCH", body }),
    delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Unauthenticated probe, used to wake a sleeping free-tier host early. */
export async function pingApi(): Promise<boolean> {
    try {
        const response = await fetch(`${BASE_URL}/healthcheck`);
        return response.ok;
    } catch {
        return false;
    }
}
