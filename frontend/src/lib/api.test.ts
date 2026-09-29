import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    api,
    ApiError,
    clearTokens,
    getAccessToken,
    getRefreshToken,
    onSessionLost,
    request,
    setTokens,
} from "./api";

/*
 * This module is stubbed out wholesale by every other test file, so nothing
 * else covers it -- and it holds the most intricate logic in the client: the
 * 401 retry and the single-flight refresh. A bug here signs people out at
 * random, which is the kind of thing that gets reported as "it's just flaky".
 */

const BASE = "http://localhost:8000/api/v1";

function jsonResponse(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

const ok = (data: unknown) =>
    jsonResponse(200, { statusCode: 200, data, message: "ok", success: true });

const unauthorized = () =>
    jsonResponse(401, {
        statusCode: 401,
        data: null,
        message: "Invalid access token",
        success: false,
    });

/** Resolves only when the test says so, to hold requests in flight. */
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
        resolve = r;
    });
    return { promise, resolve };
}

/**
 * `.catch((e) => e)` yields `unknown`, so narrow before reading the fields.
 * Asserting here rather than casting keeps the check in the test's failure
 * output: a non-ApiError rejection reports as such instead of a TypeError.
 */
function assertApiError(value: unknown): asserts value is ApiError {
    expect(value).toBeInstanceOf(ApiError);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    clearTokens();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    clearTokens();
    vi.unstubAllGlobals();
});

describe("request", () => {
    it("sends the access token and unwraps the envelope", async () => {
        setTokens({ accessToken: "access-1", refreshToken: "refresh-1" });
        fetchMock.mockResolvedValue(ok({ _id: "p1" }));

        await expect(api.get("/projects/p1")).resolves.toEqual({ _id: "p1" });

        const [url, init] = fetchMock.mock.calls[0]!;
        expect(url).toBe(`${BASE}/projects/p1`);
        expect(init.headers.Authorization).toBe("Bearer access-1");
    });

    it("JSON-encodes a plain body but leaves FormData alone", async () => {
        // A fresh Response per call: a body can only be read once, and
        // mockResolvedValue would hand the same object to both requests.
        fetchMock.mockImplementation(() => Promise.resolve(ok({})));

        await api.post("/projects", { name: "x" });
        expect(fetchMock.mock.calls[0]![1].headers["Content-Type"]).toBe(
            "application/json",
        );

        const form = new FormData();
        form.append("title", "x");
        await api.post("/tasks/p1", form);

        // Deliberately absent: the browser has to set it so it can include the
        // multipart boundary, which we cannot generate here.
        expect(
            fetchMock.mock.calls[1]![1].headers["Content-Type"],
        ).toBeUndefined();
        expect(fetchMock.mock.calls[1]![1].body).toBe(form);
    });

    it("flattens the validator's field errors", async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(422, {
                statusCode: 422,
                data: null,
                message: "Some of the submitted fields are invalid",
                success: false,
                errors: [{ email: "Email is invalid" }, { name: "Required" }],
            }),
        );

        const caught = await api.post("/auth/login", {}).catch((e) => e);
        assertApiError(caught);
        expect(caught.status).toBe(422);
        expect(caught.fieldErrors).toEqual({
            email: "Email is invalid",
            name: "Required",
        });
    });

    it("reports an unreachable server as a network error", async () => {
        fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

        const caught = await api.get("/projects").catch((e) => e);
        assertApiError(caught);
        expect(caught.status).toBe(0);
        expect(caught.isNetworkError).toBe(true);
    });
});

describe("401 handling", () => {
    it("refreshes once and retries the original request", async () => {
        setTokens({ accessToken: "stale", refreshToken: "refresh-1" });

        fetchMock
            .mockResolvedValueOnce(unauthorized())
            .mockResolvedValueOnce(
                ok({
                    accessToken: "access-2",
                    refreshToken: "refresh-2",
                    user: { _id: "u1" },
                }),
            )
            .mockResolvedValueOnce(ok({ _id: "p1" }));

        await expect(api.get("/projects/p1")).resolves.toEqual({ _id: "p1" });

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock.mock.calls[1]![0]).toBe(`${BASE}/auth/refresh-token`);

        // The rotated pair replaced the old one, and the retry carried it.
        expect(getAccessToken()).toBe("access-2");
        expect(getRefreshToken()).toBe("refresh-2");
        expect(fetchMock.mock.calls[2]![1].headers.Authorization).toBe(
            "Bearer access-2",
        );
    });

    it("does not refresh when there is no refresh token to spend", async () => {
        fetchMock.mockResolvedValue(unauthorized());

        await expect(api.get("/projects")).rejects.toBeInstanceOf(ApiError);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("gives up after one retry rather than looping", async () => {
        setTokens({ accessToken: "stale", refreshToken: "refresh-1" });

        fetchMock
            .mockResolvedValueOnce(unauthorized())
            .mockResolvedValueOnce(
                ok({
                    accessToken: "access-2",
                    refreshToken: "refresh-2",
                    user: { _id: "u1" },
                }),
            )
            // The retry 401s too: a second refresh here would loop forever.
            .mockResolvedValueOnce(unauthorized());

        await expect(api.get("/projects")).rejects.toBeInstanceOf(ApiError);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("clears the session when the refresh itself is rejected", async () => {
        setTokens({ accessToken: "stale", refreshToken: "spent" });

        fetchMock
            .mockResolvedValueOnce(unauthorized())
            .mockResolvedValueOnce(unauthorized());

        await expect(api.get("/projects")).rejects.toBeInstanceOf(ApiError);
        expect(getRefreshToken()).toBeNull();
    });

    it("refreshes once for many requests that 401 together", async () => {
        setTokens({ accessToken: "stale", refreshToken: "refresh-1" });

        const refresh = deferred<Response>();
        let refreshCalls = 0;

        fetchMock.mockImplementation((url: string) => {
            if (url.endsWith("/auth/refresh-token")) {
                refreshCalls += 1;
                return refresh.promise;
            }
            // Every request 401s until the refresh lands, then succeeds.
            return Promise.resolve(
                getAccessToken() === "access-2"
                    ? ok({ ok: true })
                    : unauthorized(),
            );
        });

        const inFlight = Promise.all([
            request("/projects"),
            request("/tasks/p1"),
            request("/notes/p1"),
        ]);

        // Let all three hit their 401 and reach the refresh gate.
        await Promise.resolve();
        await Promise.resolve();

        refresh.resolve(
            ok({
                accessToken: "access-2",
                refreshToken: "refresh-2",
                user: { _id: "u1" },
            }),
        );
        await expect(inFlight).resolves.toHaveLength(3);

        /*
         * The point of the single flight. The API rotates the refresh token on
         * every call, so three refreshes would spend three tokens and the last
         * response to land would store an already-invalidated one -- signing
         * the user out moments later, for no reason they could observe.
         */
        expect(refreshCalls).toBe(1);
        expect(getRefreshToken()).toBe("refresh-2");
    });
});

describe("onSessionLost", () => {
    const subscriptions: Array<() => void> = [];
    const subscribe = (listener: () => void) => {
        subscriptions.push(onSessionLost(listener));
    };

    afterEach(() => {
        // The listener set lives on the module, so one left subscribed would
        // outlive its own test and keep firing through the rest of the file.
        while (subscriptions.length) subscriptions.pop()?.();
    });

    it("fires when the server refuses the refresh token", async () => {
        setTokens({ accessToken: "access-1", refreshToken: "refresh-1" });
        const listener = vi.fn();
        subscribe(listener);

        fetchMock.mockImplementation(() => Promise.resolve(unauthorized()));

        await expect(request("/projects")).rejects.toBeInstanceOf(ApiError);

        /*
         * The client is the only part of the app that learns a session is over.
         * Without this signal it drops the tokens and says nothing, and the UI
         * keeps rendering a signed-in shell with the user's name in the header
         * over panels that all fail.
         */
        expect(listener).toHaveBeenCalledTimes(1);
        expect(getRefreshToken()).toBeNull();
    });

    it("does not fire when the refresh request never arrives", async () => {
        setTokens({ accessToken: "access-1", refreshToken: "refresh-1" });
        const listener = vi.fn();
        subscribe(listener);

        fetchMock.mockImplementation((input: string) =>
            input.includes("/auth/refresh-token")
                ? Promise.reject(new TypeError("Failed to fetch"))
                : Promise.resolve(unauthorized()),
        );

        await expect(request("/projects")).rejects.toBeInstanceOf(ApiError);

        // Losing the network for a moment is not the same as being signed out,
        // and treating it as such would end a session over a dropped packet.
        expect(listener).not.toHaveBeenCalled();
        expect(getRefreshToken()).toBe("refresh-1");
    });

    it("does not fire when there was no session to lose", async () => {
        const listener = vi.fn();
        subscribe(listener);

        fetchMock.mockImplementation(() => Promise.resolve(unauthorized()));

        await expect(request("/projects")).rejects.toBeInstanceOf(ApiError);

        // A 401 on a public screen is just a 401.
        expect(listener).not.toHaveBeenCalled();
    });

    it("stops calling a listener once it unsubscribes", async () => {
        setTokens({ accessToken: "access-1", refreshToken: "refresh-1" });
        const listener = vi.fn();
        onSessionLost(listener)();

        fetchMock.mockImplementation(() => Promise.resolve(unauthorized()));
        await expect(request("/projects")).rejects.toBeInstanceOf(ApiError);

        // React remounts in StrictMode, so a subscription that cannot be undone
        // would fire twice per event and grow for the life of the tab.
        expect(listener).not.toHaveBeenCalled();
    });
});
