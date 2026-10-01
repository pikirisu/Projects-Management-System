import { Route, Routes } from "react-router-dom";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeProject, makeUser, renderWithProviders } from "../test/utils";

vi.mock("../context/auth", () => ({
    useAuth: () => ({
        user: makeUser({ fullName: "Dana Owner", isEmailVerified: true }),
        status: "authenticated",
        logout: vi.fn(),
    }),
}));

vi.mock("../lib/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../lib/api")>();
    return {
        ...actual,
        api: { get: vi.fn() },
        pingApi: vi.fn().mockResolvedValue(true),
    };
});

const { api } = await import("../lib/api");
const { AppShell } = await import("./AppShell");

function stubApi() {
    vi.mocked(api.get).mockImplementation((path: string) => {
        if (path === "/projects") {
            return Promise.resolve([
                {
                    role: "admin",
                    project: makeProject({ _id: "p1", name: "Website" }),
                },
                {
                    role: "member",
                    project: makeProject({ _id: "p2", name: "Mobile app" }),
                },
            ]);
        }
        if (path === "/me/tasks") {
            return Promise.resolve([
                {
                    _id: "a",
                    title: "Open",
                    status: "todo",
                    project: { _id: "p1", name: "Website" },
                },
                {
                    _id: "b",
                    title: "Done",
                    status: "done",
                    project: { _id: "p1", name: "Website" },
                },
            ]);
        }
        throw new Error(`unstubbed GET ${path}`);
    });
}

function renderShell() {
    return renderWithProviders(
        <Routes>
            <Route element={<AppShell />}>
                <Route path="/projects" element={<p>projects page</p>} />
            </Route>
        </Routes>,
        { route: "/projects" },
    );
}

describe("AppShell", () => {
    it("lists every project in the sidebar", async () => {
        stubApi();
        renderShell();

        const nav = await screen.findByRole("navigation", { name: "Projects" });
        expect(
            await within(nav).findByRole("link", { name: "Website" }),
        ).toHaveAttribute("href", "/projects/p1");
        expect(
            within(nav).getByRole("link", { name: "Mobile app" }),
        ).toBeInTheDocument();
    });

    it("counts only the open tasks assigned to you", async () => {
        stubApi();
        renderShell();

        const myTasks = await screen.findByRole("link", { name: /My tasks/ });
        expect(await within(myTasks).findByText("1")).toBeInTheDocument();
    });

    it("switches the theme for the whole document", async () => {
        stubApi();
        const user = userEvent.setup();
        renderShell();

        await user.click(screen.getByRole("button", { name: "Dark theme" }));
        expect(document.documentElement.dataset.theme).toBe("dark");
        expect(
            screen.getByRole("button", { name: "Dark theme" }),
        ).toHaveAttribute("aria-pressed", "true");

        await user.click(screen.getByRole("button", { name: "Light theme" }));
        expect(document.documentElement.dataset.theme).toBe("light");
    });
});
