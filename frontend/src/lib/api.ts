import type { ApiEnvelope, AuthPayload } from "./types";

const BASE_URL = (
    import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1"
).replace(/\/+$/, "");

/*
 * Auth strategy: Authorization: Bearer, not cookies.
 *
 * The frontend and the API are deployed to different origins (Vercel and
 * Render), so cookie auth would need SameSite=None -- which Safari's tracking
 * prevention and Chrome's third-party cookie work actively block. Login would
 * fail for some visitors and nobody could tell why.
 *
 * The API already returns both tokens in the login body and accepts a refresh
 * token from the request body, so a pure bearer flow needs no server change.
 *
 * The access token lives in memory only: a tab reload drops it, and the refresh
 * below mints a new one. The refresh token has to survive that reload, so it
 * goes in localStorage. That is a deliberate tradeoff -- script running on this
 * origin could read it -- accepted because the alternative silently breaks the
 * app for real users. A browser-only deployment that could rely on same-site
 * cookies should prefer those.
 */
let accessToken: string | null = null;

const REFRESH_STORAGE_KEY = "project-camp.refreshToken";

/** Storage throws in some privacy modes; never let that break a render. */
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

/**
 * The validator middleware emits `[{ email: "Email is invalid" }, ...]`.
 * Flatten it so a form can look up a message by field name.
 */
function toFieldErrors(
    errors: Array<Record<string, string>> | undefined,
): Record<string, string> {
    const result: Record<string, string> = {};
    for (const entry of errors ?? []) {
        if (entry && typeof entry === "object") Object.assign(result, entry);
    }
    return result;
}

interface RequestOptions {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    /** Plain object is JSON-encoded; FormData is passed through untouched. */
    body?: unknown;
    /** Internal: prevents a refresh loop. */
    skipAuthRetry?: boolean;
}

/*
 * Refresh is single-flight. Several queries can 401 at once after a reload, and
 * without this each would post its own refresh -- the API rotates the refresh
 * token on every call, so the slowest response would overwrite the newest token
 * with an already-spent one and log the user out.
 */
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
    if (!refreshInFlight) {
        refreshInFlight = (async () => {
            const refreshToken = getRefreshToken();
            if (!refreshToken) return false;

            try {
                const response = await fetch(`${BASE_URL}/auth/refresh-token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refreshToken }),
                });
                if (!response.ok) {
                    clearTokens();
                    return false;
                }
                const envelope =
                    (await response.json()) as ApiEnvelope<AuthPayload>;
                setTokens({
                    accessToken: envelope.data.accessToken,
                    refreshToken: envelope.data.refreshToken,
                });
                return true;
            } catch {
                return false;
            }
        })().finally(() => {
            refreshInFlight = null;
        });
    }
    return refreshInFlight;
}

export async function request<T>(
    path: string,
    options: RequestOptions = {},
): Promise<T> {
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    let body: BodyInit | undefined;
    if (options.body instanceof FormData) {
        // Deliberately no Content-Type: the browser has to set it so it can
        // include the multipart boundary.
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
        const refreshed = await refreshSession();
        if (refreshed) {
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

/**
 * Unauthenticated liveness probe. Used to wake a sleeping free-tier host before
 * the user's first real request lands, and to drive the "waking up" notice.
 */
export async function pingApi(): Promise<boolean> {
    try {
        const response = await fetch(`${BASE_URL}/healthcheck`);
        return response.ok;
    } catch {
        return false;
    }
}
