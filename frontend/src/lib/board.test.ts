import { describe, expect, it } from "vitest";
import { filterTasks, isFiltering, NO_FILTERS, sortTasks } from "./board";
import type { Task } from "./types";

const task = (overrides: Partial<Task>): Task => ({
    _id: overrides.title ?? "t",
    title: "Task",
    project: "p1",
    status: "todo",
    ...overrides,
});

const tasks = [
    task({
        title: "Write copy",
        priority: "low",
        assignedTo: "me",
        createdAt: "2026-01-01",
    }),
    task({
        title: "Fix login",
        description: "Safari only",
        priority: "high",
        dueDate: "2026-03-01",
        createdAt: "2026-01-03",
    }),
    task({
        title: "Plan launch",
        dueDate: "2026-02-01",
        assignedTo: "them",
        createdAt: "2026-01-02",
    }),
];

const titles = (list: Task[]) => list.map((entry) => entry.title);

describe("filterTasks", () => {
    it("searches titles and descriptions, ignoring case", () => {
        expect(
            titles(filterTasks(tasks, { ...NO_FILTERS, query: "SAFARI" })),
        ).toEqual(["Fix login"]);
    });

    it("resolves 'me' against the signed-in user", () => {
        expect(
            titles(filterTasks(tasks, { ...NO_FILTERS, assignee: "me" }, "me")),
        ).toEqual(["Write copy"]);
        expect(
            titles(
                filterTasks(tasks, { ...NO_FILTERS, assignee: "unassigned" }),
            ),
        ).toEqual(["Fix login"]);
    });

    it("treats a task without a priority as medium", () => {
        expect(
            titles(filterTasks(tasks, { ...NO_FILTERS, priority: "medium" })),
        ).toEqual(["Plan launch"]);
    });

    it("knows when a filter is on", () => {
        expect(isFiltering(NO_FILTERS)).toBe(false);
        expect(isFiltering({ ...NO_FILTERS, query: "  " })).toBe(false);
        expect(isFiltering({ ...NO_FILTERS, priority: "high" })).toBe(true);
    });
});

describe("sortTasks", () => {
    it("sorts newest first", () => {
        expect(titles(sortTasks(tasks, "newest"))).toEqual([
            "Fix login",
            "Plan launch",
            "Write copy",
        ]);
    });

    it("sorts by due date, undated last", () => {
        expect(titles(sortTasks(tasks, "due"))).toEqual([
            "Plan launch",
            "Fix login",
            "Write copy",
        ]);
    });

    it("sorts by priority, highest first", () => {
        expect(titles(sortTasks(tasks, "priority"))).toEqual([
            "Fix login",
            "Plan launch",
            "Write copy",
        ]);
    });

    it("never reorders the list it was given", () => {
        const before = titles(tasks);
        sortTasks(tasks, "priority");
        expect(titles(tasks)).toEqual(before);
    });
});
