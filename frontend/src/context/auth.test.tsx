import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/utils";
import { api, clearTokens, setTokens } from "../lib/api";
import { AuthProvider, useAuth } from "./auth";
import { App } from "../App";

/*
 * These exercise the real API client rather than a mock of it, because the
 * behaviour under test spans both: the client is what discovers that a session
 * is over, and the context is the only thing that can act on it. Mocking the
 * client would test the two halves separately and prove nothing about the join.
 */

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

const currentUser = {
    _id: "u1",
    username: "dana",
    email: "dana@example.com",
    fullName: "Dana Owner",
};

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

/** A stand-in for any screen that loads something behind the session. */
function Probe() {
    const { status, sessionExpired } = useAuth();
    return (
        <div>
            <p>{`status: ${status}`}</p>
            {sessionExpired && <p>session expired</p>}
            <button
                type="button"
                onClick={() => {
                    void api.get("/projects").catch(() => {});
                }}
            >
                Load projects
            </button>
        </div>
    );
}

describe("AuthProvider", () => {
    it("signs the user out when a session dies mid-use", async () => {
        setTokens({ accessToken: "access-1", refreshToken: "refresh-1" });
        fetchMock.mockImplementation((input: string) =>
            Promise.resolve(
                input.includes("/auth/current-user")
                    ? ok(currentUser)
                    : unauthorized(),
            ),
        );

        const user = userEvent.setup();
        renderWithProviders(
            <AuthProvider>
                <Probe />
            </AuthProvider>,
        );

        expect(
            await screen.findByText("status: authenticated"),
        ).toBeInTheDocument();

        /*
         * A password change on another device revokes this tab's tokens with no
         * warning, so the next query is the first anyone hears of it. Before
         * the context listened for that, the tokens were dropped in silence and
         * the app carried on rendering a signed-in shell whose every panel
         * failed -- with the user's own name still in the header.
         */
        await user.click(screen.getByRole("button", { name: "Load projects" }));

        expect(
            await screen.findByText("status: anonymous"),
        ).toBeInTheDocument();
        expect(screen.getByText("session expired")).toBeInTheDocument();
    });

    it("keeps the session when the refresh request never arrives", async () => {
        setTokens({ accessToken: "access-1", refreshToken: "refresh-1" });
        fetchMock.mockImplementation((input: string) => {
            if (input.includes("/auth/current-user")) {
                return Promise.resolve(ok(currentUser));
            }
            if (input.includes("/auth/refresh-token")) {
                return Promise.reject(new TypeError("Failed to fetch"));
            }
            return Promise.resolve(unauthorized());
        });

        const user = userEvent.setup();
        renderWithProviders(
            <AuthProvider>
                <Probe />
            </AuthProvider>,
        );
        expect(
            await screen.findByText("status: authenticated"),
        ).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Load projects" }));

        // Offline for a moment is not signed out. Ending the session here would
        // discard whatever the user had open because their wifi blinked.
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
        expect(screen.getByText("status: authenticated")).toBeInTheDocument();
        expect(screen.queryByText("session expired")).not.toBeInTheDocument();
    });

    it("explains itself on the sign-in screen", async () => {
        // The shape of a reload after the session was revoked elsewhere: a
        // refresh token is still in storage, and the server rejects both it and
        // the restore request it was meant to rescue.
        setTokens({ accessToken: "access-1", refreshToken: "refresh-1" });
        fetchMock.mockImplementation(() => Promise.resolve(unauthorized()));

        renderWithProviders(
            <AuthProvider>
                <App />
            </AuthProvider>,
            { route: "/projects" },
        );

        expect(
            await screen.findByRole("heading", { name: "Sign in" }),
        ).toBeInTheDocument();
        expect(screen.getByText(/Your session ended/)).toBeInTheDocument();
    });

    it("says nothing of the sort on an ordinary visit", async () => {
        fetchMock.mockImplementation(() => Promise.resolve(unauthorized()));

        renderWithProviders(
            <AuthProvider>
                <App />
            </AuthProvider>,
            { route: "/login" },
        );

        expect(
            await screen.findByRole("heading", { name: "Sign in" }),
        ).toBeInTheDocument();
        // Nobody signed out, so there is nothing to explain.
        expect(
            screen.queryByText(/Your session ended/),
        ).not.toBeInTheDocument();
    });
});
