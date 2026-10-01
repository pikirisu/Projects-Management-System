import { refId } from "./display";
import type { Task, TaskPriority } from "./types";

/** "me" is resolved against the signed-in user rather than stored as an id. */
export type AssigneeFilter = "all" | "me" | "unassigned" | (string & {});
export type PriorityFilter = "all" | TaskPriority;
export type TaskSort = "newest" | "due" | "priority";

export interface BoardFilters {
    query: string;
    assignee: AssigneeFilter;
    priority: PriorityFilter;
}

export const NO_FILTERS: BoardFilters = {
    query: "",
    assignee: "all",
    priority: "all",
};

export const isFiltering = (filters: BoardFilters) =>
    filters.query.trim() !== "" ||
    filters.assignee !== "all" ||
    filters.priority !== "all";

const PRIORITY_RANK: Record<TaskPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
};

/** Tasks predating priorities count as medium. */
export const priorityOf = (task: Pick<Task, "priority">): TaskPriority =>
    task.priority ?? "medium";

function matchesAssignee(task: Task, filter: AssigneeFilter, myId?: string) {
    const assigned = refId(task.assignedTo);
    if (filter === "all") return true;
    if (filter === "unassigned") return !assigned;
    if (filter === "me") return Boolean(myId) && assigned === myId;
    return assigned === filter;
}

function matchesQuery(task: Task, query: string) {
    const needle = query.trim().toLowerCase();
    return (
        !needle ||
        task.title.toLowerCase().includes(needle) ||
        (task.description ?? "").toLowerCase().includes(needle)
    );
}

// Decision: the board filters and sorts in the browser. GET /tasks/:projectId
// returns the whole project in one response and takes no query parameters, so
// a request per keystroke would fetch the same rows back. Pagination and
// server-side filtering are the fix once a project outgrows a few hundred tasks.
export function filterTasks(
    tasks: Task[],
    filters: BoardFilters,
    myId?: string,
): Task[] {
    return tasks.filter(
        (task) =>
            matchesAssignee(task, filters.assignee, myId) &&
            matchesQuery(task, filters.query) &&
            (filters.priority === "all" ||
                priorityOf(task) === filters.priority),
    );
}

const time = (value?: string | null) =>
    value ? Date.parse(value) : Number.POSITIVE_INFINITY;

type Sortable = Pick<Task, "createdAt" | "dueDate" | "priority">;

const COMPARATORS: Record<TaskSort, (a: Sortable, b: Sortable) => number> = {
    newest: (a, b) => -(time(a.createdAt) - time(b.createdAt)) || 0,
    // Tasks without a due date go last.
    due: (a, b) => time(a.dueDate) - time(b.dueDate) || 0,
    priority: (a, b) =>
        PRIORITY_RANK[priorityOf(a)] - PRIORITY_RANK[priorityOf(b)],
};

export function sortTasks<T extends Sortable>(tasks: T[], sort: TaskSort): T[] {
    return [...tasks].sort(COMPARATORS[sort]);
}
