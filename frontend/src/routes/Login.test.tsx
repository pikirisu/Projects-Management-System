import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/utils";

const session = vi.hoisted(() => ({ login: vi.fn() }));

vi.mock("../context/auth", () => ({
    useAuth: () => ({
        user: null,
        status: "anonymous",
        sessionExpired: false,
        login: session.login,
    }),
}));

vi.mock("../lib/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../lib/api")>();
    // AuthShell probes the API on mount to drive its wake-up banner.
    return { ...actual, pingApi: vi.fn().mockResolvedValue(true) };
});

const { Login } = await import("./Login");

function renderLogin() {
    return renderWithProviders(
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/projects" element={<p>projects page</p>} />
        </Routes>,
        { route: "/login" },
    );
}

afterEach(() => {
    vi.unstubAllEnvs();
    session.login.mockReset();
});

describe("Login", () => {
    it("offers no demo unless the build was given one", () => {
        renderLogin();
        expect(
            screen.queryByRole("button", { name: "Try the demo" }),
        ).not.toBeInTheDocument();
    });

    it("signs into the demo account in one click", async () => {
        vi.stubEnv("VITE_DEMO_EMAIL", "demo.owner@example.com");
        vi.stubEnv("VITE_DEMO_PASSWORD", "DemoPass123!");
        session.login.mockResolvedValue(undefined);
        const user = userEvent.setup();
        renderLogin();

        await user.click(screen.getByRole("button", { name: "Try the demo" }));

        await waitFor(() =>
            expect(session.login).toHaveBeenCalledWith(
                "demo.owner@example.com",
                "DemoPass123!",
            ),
        );
        expect(await screen.findByText("projects page")).toBeInTheDocument();
    });

    it("still signs in with what was typed", async () => {
        session.login.mockResolvedValue(undefined);
        const user = userEvent.setup();
        renderLogin();

        await user.type(screen.getByLabelText("Email"), "dana@example.com");
        await user.type(screen.getByLabelText("Password"), "Passw0rd!");
        await user.click(screen.getByRole("button", { name: "Sign in" }));

        await waitFor(() =>
            expect(session.login).toHaveBeenCalledWith(
                "dana@example.com",
                "Passw0rd!",
            ),
        );
    });
});
