import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/utils";
import type { MyTask } from "../lib/types";

vi.mock("../lib/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../lib/api")>();
    return { ...actual, api: { get: vi.fn() } };
});

const { api } = await import("../lib/api");
const { MyTasks } = await import("./MyTasks");

/** A YYYY-MM-DD `days` from today, as the API would store it. */
const inDays = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T00:00:00.000Z`;
};

const myTask = (overrides: Partial<MyTask>): MyTask => ({
    _id: overrides.title ?? "t",
    title: "Task",
    status: "todo",
    project: { _id: "p1", name: "Website" },
    ...overrides,
});

function stub(tasks: MyTask[]) {
    vi.mocked(api.get).mockResolvedValue(tasks);
}

describe("MyTasks", () => {
    it("groups open tasks by when they are due", async () => {
        stub([
            myTask({ title: "Late invoice", dueDate: inDays(-2) }),
            myTask({ title: "Standup notes", dueDate: inDays(0) }),
            myTask({ title: "Roadmap", dueDate: inDays(3) }),
            myTask({ title: "Someday", dueDate: null }),
        ]);
        renderWithProviders(<MyTasks />);

        for (const [group, title] of [
            ["Overdue", "Late invoice"],
            ["Today", "Standup notes"],
            ["Next 7 days", "Roadmap"],
            ["No due date", "Someday"],
        ]) {
            const section = await screen.findByRole("region", { name: group });
            expect(within(section).getByText(title!)).toBeInTheDocument();
        }
    });

    it("links each task into its project's board, opened", async () => {
        stub([
            myTask({
                _id: "t9",
                title: "Roadmap",
                project: { _id: "p7", name: "Mobile" },
            }),
        ]);
        renderWithProviders(<MyTasks />);

        const link = await screen.findByRole("link", { name: /Roadmap/ });
        expect(link).toHaveAttribute("href", "/projects/p7?task=t9");
        expect(within(link).getByText("Mobile")).toBeInTheDocument();
    });

    it("hides completed work until asked", async () => {
        stub([
            myTask({ title: "Open one" }),
            myTask({ title: "Finished one", status: "done" }),
        ]);
        const user = userEvent.setup();
        renderWithProviders(<MyTasks />);

        expect(await screen.findByText("Open one")).toBeInTheDocument();
        expect(screen.queryByText("Finished one")).not.toBeInTheDocument();

        await user.click(screen.getByLabelText(/Show completed/));
        expect(screen.getByText("Finished one")).toBeInTheDocument();
    });

    it("says so when everything is done", async () => {
        stub([myTask({ title: "Finished one", status: "done" })]);
        renderWithProviders(<MyTasks />);

        expect(await screen.findByText("All caught up")).toBeInTheDocument();
    });
});
