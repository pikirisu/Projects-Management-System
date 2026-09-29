import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type {
    Note,
    Project,
    ProjectMemberEntry,
    Role,
    Subtask,
    Task,
    TaskDetail,
    User,
} from "../lib/types";

/**
 * Retries are off and there is no cache between tests: a retried request would
 * make a failure assertion wait out the backoff, and a shared cache would let
 * one test's data satisfy the next one's query.
 */
export function renderWithProviders(
    ui: ReactElement,
    { route = "/" }: { route?: string } = {},
) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
            mutations: { retry: false },
        },
    });

    function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
            </QueryClientProvider>
        );
    }

    return { queryClient, ...render(ui, { wrapper: Wrapper }) };
}

let counter = 0;
const nextId = () =>
    `65a000000000000000000${(counter++ + 10).toString().padStart(3, "0")}`;

export function makeUser(overrides: Partial<User> = {}): User {
    const id = overrides._id ?? nextId();
    return {
        _id: id,
        username: `user${id.slice(-3)}`,
        email: `user${id.slice(-3)}@example.com`,
        fullName: "Test User",
        avatar: { url: "https://placehold.co/200x200" },
        ...overrides,
    };
}

export function makeMember(
    role: Role,
    user: User = makeUser(),
): ProjectMemberEntry {
    return {
        project: "project-1",
        user,
        role,
        createdAt: "2026-01-05T10:00:00.000Z",
    };
}

export function makeProject(overrides: Partial<Project> = {}): Project {
    return {
        _id: "project-1",
        name: "Website relaunch",
        description: "Marketing site rebuild",
        createdAt: "2026-01-01T10:00:00.000Z",
        ...overrides,
    };
}

export function makeTask(overrides: Partial<Task> = {}): Task {
    return {
        _id: nextId(),
        title: "A task",
        project: "project-1",
        status: "todo",
        attachments: [],
        createdAt: "2026-01-02T10:00:00.000Z",
        ...overrides,
    };
}

export function makeTaskDetail(
    overrides: Partial<TaskDetail> = {},
): TaskDetail {
    return { ...makeTask(), subtasks: [], ...overrides };
}

export function makeSubtask(overrides: Partial<Subtask> = {}): Subtask {
    return {
        _id: nextId(),
        title: "A subtask",
        task: "task-1",
        isCompleted: false,
        ...overrides,
    };
}

export function makeNote(overrides: Partial<Note> = {}): Note {
    return {
        _id: nextId(),
        project: "project-1",
        content: "Ship behind a flag.",
        createdAt: "2026-01-03T10:00:00.000Z",
        ...overrides,
    };
}
