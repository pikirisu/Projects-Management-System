import { Route, Routes } from "react-router-dom";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeProject, renderWithProviders } from "../test/utils";
import type { ProjectListEntry } from "../lib/types";

vi.mock("../lib/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../lib/api")>();
    return { ...actual, api: { get: vi.fn(), post: vi.fn() } };
});

const { api } = await import("../lib/api");
const { Projects } = await import("./Projects");

const entries: ProjectListEntry[] = [
    {
        role: "admin",
        project: makeProject({
            _id: "p1",
            name: "Website relaunch",
            members: 3,
            taskCounts: { todo: 4, in_progress: 1, done: 3 },
        }),
    },
];

function renderProjects() {
    return renderWithProviders(
        <Routes>
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:projectId" element={<p>project page</p>} />
        </Routes>,
        { route: "/projects" },
    );
}

describe("Projects", () => {
    it("shows each project's progress from the server's counts", async () => {
        vi.mocked(api.get).mockResolvedValue(entries);
        renderProjects();

        const card = (
            await screen.findByRole("heading", {
                name: "Website relaunch",
            })
        ).closest("a")!;
        expect(within(card).getByText(/3 of 8 done/)).toBeInTheDocument();
        expect(within(card).getByRole("progressbar")).toHaveAttribute(
            "aria-valuenow",
            "3",
        );
        expect(within(card).getByText("3 members")).toBeInTheDocument();
    });

    it("creates a project and opens it", async () => {
        vi.mocked(api.get).mockResolvedValue(entries);
        vi.mocked(api.post).mockResolvedValue(
            makeProject({ _id: "p2", name: "Mobile app" }),
        );
        const user = userEvent.setup();
        renderProjects();

        await user.click(
            await screen.findByRole("button", { name: "New project" }),
        );
        const dialog = screen.getByRole("dialog", { name: "New project" });
        await user.type(within(dialog).getByLabelText("Name"), "Mobile app");
        await user.click(
            within(dialog).getByRole("button", { name: "Create project" }),
        );

        await waitFor(() =>
            expect(api.post).toHaveBeenCalledWith("/projects", {
                name: "Mobile app",
                description: undefined,
            }),
        );
        expect(await screen.findByText("project page")).toBeInTheDocument();
    });

    it("invites a first project when there are none", async () => {
        vi.mocked(api.get).mockResolvedValue([]);
        renderProjects();

        expect(await screen.findByText("No projects yet")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "New project" }),
        ).toBeInTheDocument();
    });
});
