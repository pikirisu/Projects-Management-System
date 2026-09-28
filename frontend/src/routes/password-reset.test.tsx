import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeUser, renderWithProviders } from "../test/utils";
import type { User } from "../lib/types";

// Mutable: one test needs a signed-in browser to be a real condition.
const session = vi.hoisted(() => ({
    user: null as User | null,
    status: "anonymous" as "loading" | "authenticated" | "anonymous",
}));

vi.mock("../context/auth", () => ({
    useAuth: () => ({
        user: session.user,
        status: session.status,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
    }),
}));

vi.mock("../lib/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../lib/api")>();
    return {
        ...actual,
        api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
        // AuthShell probes the API on mount to drive its wake-up banner.
        pingApi: vi.fn().mockResolvedValue(true),
    };
});

const { api, ApiError } = await import("../lib/api");
const { ForgotPassword } = await import("./ForgotPassword");
const { ResetPassword } = await import("./ResetPassword");

const post = vi.mocked(api.post);

beforeEach(() => {
    session.user = null;
    session.status = "anonymous";
});

describe("ForgotPassword", () => {
    it("posts the address and confirms without revealing whether it exists", async () => {
        post.mockResolvedValue({});
        const user = userEvent.setup();
        renderWithProviders(<ForgotPassword />);

        await user.type(screen.getByLabelText("Email"), "dana@example.com");
        await user.click(
            screen.getByRole("button", { name: "Send reset link" }),
        );

        await waitFor(() =>
            expect(post).toHaveBeenCalledWith("/auth/forgot-password", {
                email: "dana@example.com",
            }),
        );

        // Deliberately hedged: the API answers 200 for unknown addresses too,
        // and a definite "sent" here would leak which accounts exist.
        expect(await screen.findByRole("status")).toHaveTextContent(
            /If an account exists for dana@example\.com/,
        );
    });

    it("shows the server's message when the request fails", async () => {
        post.mockRejectedValue(new ApiError(422, "Email is invalid"));
        const user = userEvent.setup();
        renderWithProviders(<ForgotPassword />);

        await user.type(screen.getByLabelText("Email"), "nope");
        await user.click(
            screen.getByRole("button", { name: "Send reset link" }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Email is invalid",
        );
    });
});

function renderReset(token = "tok-123") {
    return renderWithProviders(
        <Routes>
            <Route path="/reset-password/:token" element={<ResetPassword />} />
        </Routes>,
        { route: `/reset-password/${token}` },
    );
}

describe("ResetPassword", () => {
    it("takes the token from the URL the email links to", async () => {
        post.mockResolvedValue({});
        const user = userEvent.setup();
        renderReset("abc123");

        await user.type(screen.getByLabelText("New password"), "N3wPassw0rd!");
        await user.type(
            screen.getByLabelText("Confirm new password"),
            "N3wPassw0rd!",
        );
        await user.click(
            screen.getByRole("button", { name: "Set new password" }),
        );

        await waitFor(() =>
            expect(post).toHaveBeenCalledWith("/auth/reset-password/abc123", {
                newPassword: "N3wPassw0rd!",
            }),
        );
        expect(
            await screen.findByRole("heading", { name: "Password updated" }),
        ).toBeInTheDocument();
    });

    it("refuses to submit a mistyped confirmation", async () => {
        const user = userEvent.setup();
        renderReset();

        await user.type(screen.getByLabelText("New password"), "N3wPassw0rd!");
        await user.type(
            screen.getByLabelText("Confirm new password"),
            "N3wPassw0rd",
        );

        expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Set new password" }),
        ).toBeDisabled();
        expect(post).not.toHaveBeenCalled();
    });

    it("stays reachable for a browser that still holds a session", async () => {
        // The route is mounted outside RedirectIfSignedIn on purpose: a stale
        // session would otherwise bounce the link to /projects and discard the
        // token. Signing in here is what makes that a real condition.
        session.user = makeUser();
        session.status = "authenticated";

        const { App } = await import("../App");
        renderWithProviders(<App />, { route: "/reset-password/abc123" });

        expect(
            await screen.findByRole("heading", {
                name: "Choose a new password",
            }),
        ).toBeInTheDocument();
    });

    it("explains an expired link and offers a new one", async () => {
        post.mockRejectedValue(
            new ApiError(400, "Token is invalid or expired"),
        );
        const user = userEvent.setup();
        renderReset();

        await user.type(screen.getByLabelText("New password"), "N3wPassw0rd!");
        await user.type(
            screen.getByLabelText("Confirm new password"),
            "N3wPassw0rd!",
        );
        await user.click(
            screen.getByRole("button", { name: "Set new password" }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Token is invalid or expired",
        );
        expect(
            screen.getByRole("link", { name: "Request another" }),
        ).toHaveAttribute("href", "/forgot-password");
    });
});
