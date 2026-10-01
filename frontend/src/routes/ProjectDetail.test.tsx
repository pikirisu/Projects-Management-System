import { Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    makeMember,
    makeNote,
    makeProject,
    makeTask,
    makeTaskDetail,
    makeUser,
    renderWithProviders,
} from "../test/utils";
import type { Role, User } from "../lib/types";

// Mutable so each test can decide who is signed in before rendering.
const session = vi.hoisted(() => ({ user: null as User | null }));

/*
 * jsdom implements no DataTransfer, so drag events carry a stub. The board
 * reads the dragged id from React state rather than from here -- dataTransfer
 * contents are unreadable during dragover in real browsers too -- but setData
 * still has to exist, because the card calls it so Firefox will start the drag.
 */
const makeDataTransfer = (id = "") => ({
    setData: vi.fn(),
    getData: vi.fn(() => id),
    effectAllowed: "",
    dropEffect: "",
});

vi.mock("../context/auth", () => ({
    useAuth: () => ({
        user: session.user,
        status: "authenticated",
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
    }),
}));

/*
 * Only the request functions are replaced; ApiError stays real so the
 * components' `instanceof ApiError` branches are exercised rather than skipped.
 */
vi.mock("../lib/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../lib/api")>();
    return {
        ...actual,
        api: {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
        },
    };
});

const { api, ApiError } = await import("../lib/api");
const { ProjectDetail } = await import("./ProjectDetail");

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);
const put = vi.mocked(api.put);

const me = makeUser({ _id: "me-1", fullName: "Dana Owner" });
const colleague = makeUser({ _id: "them-1", fullName: "Sam Teammate" });

const project = makeProject();
const tasks = [
    makeTask({ _id: "t-todo", title: "Migrate the blog", status: "todo" }),
    makeTask({
        _id: "t-doing",
        title: "Rebuild pricing",
        status: "in_progress",
        assignedTo: colleague,
    }),
    makeTask({ _id: "t-done", title: "Audit performance", status: "done" }),
];
const notes = [makeNote({ content: "Launch is gated on pricing." })];

/** Routes the four page-level queries to canned data by URL. */
function stubQueries(myRole: Role) {
    const members = [makeMember(myRole, me), makeMember("member", colleague)];

    get.mockImplementation((path: string) => {
        if (path === "/projects/project-1") return Promise.resolve(project);
        if (path === "/projects/project-1/members")
            return Promise.resolve(members);
        if (path === "/tasks/project-1") return Promise.resolve(tasks);
        if (path === "/notes/project-1") return Promise.resolve(notes);
        if (path.startsWith("/tasks/project-1/t/"))
            return Promise.resolve(
                makeTaskDetail({
                    _id: "t-todo",
                    title: "Migrate the blog",
                    description: "412 posts, plus redirects.",
                    attachments: [
                        { _id: "att-1", url: "/images/spec.pdf", size: 2048 },
                    ],
                    subtasks: [
                        {
                            _id: "s-1",
                            title: "Export the posts",
                            task: "t-todo",
                            isCompleted: false,
                        },
                    ],
                }),
            );
        throw new Error(`unstubbed GET ${path}`);
    });

    return members;
}

function renderPage() {
    return renderWithProviders(
        <Routes>
            <Route path="/projects/:projectId" element={<ProjectDetail />} />
        </Routes>,
        { route: "/projects/project-1" },
    );
}

beforeEach(() => {
    session.user = me;
});

describe("ProjectDetail", () => {
    it("shows the project and groups tasks into status columns", async () => {
        stubQueries("admin");
        renderPage();

        expect(
            await screen.findByRole("heading", { name: "Website relaunch" }),
        ).toBeInTheDocument();

        // Each task lands under its own status heading, not just somewhere.
        for (const [heading, title] of [
            ["To do", "Migrate the blog"],
            ["In progress", "Rebuild pricing"],
            ["Done", "Audit performance"],
        ] as const) {
            const column = screen
                .getByRole("heading", { name: new RegExp(`^${heading}`) })
                .closest("section");
            expect(column).not.toBeNull();
            expect(
                within(column as HTMLElement).getByText(title),
            ).toBeInTheDocument();
        }
    });

    it("derives the caller's role from the member list", async () => {
        stubQueries("project_admin");
        renderPage();

        expect(await screen.findByText("Project admin")).toBeInTheDocument();
    });

    it("offers task management to a project admin", async () => {
        stubQueries("project_admin");
        renderPage();

        expect(
            await screen.findByRole("button", { name: "New task" }),
        ).toBeInTheDocument();
    });

    it("hides task management from a plain member", async () => {
        stubQueries("member");
        renderPage();

        await screen.findByText("Migrate the blog");
        expect(
            screen.queryByRole("button", { name: "New task" }),
        ).not.toBeInTheDocument();
        // Members cannot move cards either, so no per-card status control.
        expect(
            screen.queryByLabelText("Status for Migrate the blog"),
        ).not.toBeInTheDocument();
    });

    it("shows the settings tab only to an admin", async () => {
        stubQueries("project_admin");
        const { unmount } = renderPage();
        await screen.findByText("Migrate the blog");
        expect(
            screen.queryByRole("tab", { name: "Settings" }),
        ).not.toBeInTheDocument();
        unmount();

        stubQueries("admin");
        renderPage();
        expect(
            await screen.findByRole("tab", { name: "Settings" }),
        ).toBeInTheDocument();
    });

    it("moves a card optimistically and rolls back when the server refuses", async () => {
        stubQueries("admin");
        put.mockRejectedValue(new ApiError(403, "Not allowed"));
        const user = userEvent.setup();
        renderPage();

        const select = await screen.findByLabelText(
            "Status for Migrate the blog",
        );
        expect(select).toHaveValue("todo");

        await user.selectOptions(select, "done");

        // The rollback restores the original status rather than leaving the
        // board showing a move the server never accepted.
        await waitFor(() =>
            expect(
                screen.getByLabelText("Status for Migrate the blog"),
            ).toHaveValue("todo"),
        );
    });

    it("moves a card when it is dropped on another column", async () => {
        stubQueries("admin");
        put.mockResolvedValue(
            makeTask({
                _id: "t-todo",
                title: "Migrate the blog",
                status: "done",
            }),
        );
        renderPage();

        const card = (await screen.findByText("Migrate the blog")).closest(
            '[draggable="true"]',
        );
        expect(card).not.toBeNull();

        const done = screen.getByRole("region", { name: "Done" });
        fireEvent.dragStart(card!, { dataTransfer: makeDataTransfer() });
        fireEvent.dragOver(done, { dataTransfer: makeDataTransfer() });
        fireEvent.drop(done, { dataTransfer: makeDataTransfer("t-todo") });

        /*
         * The same request the status dropdown sends. Dragging is an addition
         * to that control, not a second way of doing it -- if these ever
         * diverge, one of them is wrong.
         */
        await waitFor(() =>
            expect(put).toHaveBeenCalledWith("/tasks/project-1/t/t-todo", {
                status: "done",
            }),
        );
    });

    it("does not send a request for a drop back into the same column", async () => {
        stubQueries("admin");
        renderPage();

        const card = (await screen.findByText("Migrate the blog")).closest(
            '[draggable="true"]',
        );
        const todo = screen.getByRole("region", { name: "To do" });

        fireEvent.dragStart(card!, { dataTransfer: makeDataTransfer() });
        fireEvent.drop(todo, { dataTransfer: makeDataTransfer("t-todo") });

        // Nothing changed, so there is nothing to tell the server about.
        expect(put).not.toHaveBeenCalled();
    });

    it("offers no drag handle to a plain member", async () => {
        stubQueries("member");
        renderPage();

        const card = (await screen.findByText("Migrate the blog")).closest(
            '[draggable="true"]',
        );
        /*
         * Only a manager can change a status, so a member who could drag a card
         * would watch it snap back on a 403 -- worse than not offering it.
         */
        expect(card).toBeNull();
    });

    it("opens a task and lists its subtasks", async () => {
        stubQueries("admin");
        const user = userEvent.setup();
        renderPage();

        await user.click(
            await screen.findByRole("button", { name: "Migrate the blog" }),
        );

        const panel = await screen.findByRole("dialog");
        expect(
            within(panel).getByText("412 posts, plus redirects."),
        ).toBeInTheDocument();
        expect(
            within(panel).getByRole("checkbox", { name: "Export the posts" }),
        ).not.toBeChecked();
        expect(within(panel).getByText("0 of 1 done")).toBeInTheDocument();
    });

    it("lets a manager remove one attachment without the task", async () => {
        stubQueries("admin");
        vi.mocked(api.delete).mockResolvedValue({});
        const user = userEvent.setup();
        renderPage();

        await user.click(
            await screen.findByRole("button", { name: "Migrate the blog" }),
        );
        const panel = await screen.findByRole("dialog");

        expect(within(panel).getByText("spec.pdf")).toBeInTheDocument();
        expect(within(panel).getByText("2.0 KB")).toBeInTheDocument();

        // Named rather than just "Remove": the subtask row below offers one
        // too, and a screen reader would hear two identical buttons.
        await user.click(
            within(panel).getByRole("button", {
                name: "Remove attachment spec.pdf",
            }),
        );
        await user.click(
            within(panel).getByRole("button", {
                name: "Confirm: Remove attachment spec.pdf",
            }),
        );

        await waitFor(() =>
            expect(api.delete).toHaveBeenCalledWith(
                "/tasks/project-1/t/t-todo/attachments/att-1",
            ),
        );
    });

    it("shows a member the attachment but no way to remove it", async () => {
        stubQueries("member");
        const user = userEvent.setup();
        renderPage();

        await user.click(
            await screen.findByRole("button", { name: "Migrate the blog" }),
        );
        const panel = await screen.findByRole("dialog");

        expect(within(panel).getByText("spec.pdf")).toBeInTheDocument();
        expect(
            within(panel).queryByRole("button", {
                name: /^Remove attachment/,
            }),
        ).not.toBeInTheDocument();
    });

    it("narrows the board by search text", async () => {
        stubQueries("admin");
        const user = userEvent.setup();
        renderPage();

        await screen.findByText("Migrate the blog");
        await user.type(screen.getByLabelText("Search tasks"), "pricing");

        await waitFor(() =>
            expect(
                screen.queryByText("Migrate the blog"),
            ).not.toBeInTheDocument(),
        );
        expect(screen.getByText("Rebuild pricing")).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("1 of 3");
    });

    it("narrows the board to the signed-in user's own tasks", async () => {
        stubQueries("admin");
        const user = userEvent.setup();
        renderPage();

        await screen.findByText("Migrate the blog");
        await user.selectOptions(
            screen.getByLabelText("Filter by assignee"),
            "me",
        );

        // Only "Rebuild pricing" has an assignee, and it is the colleague --
        // so "assigned to me" is empty rather than showing everything.
        expect(await screen.findByText("No tasks match")).toBeInTheDocument();

        await user.selectOptions(
            screen.getByLabelText("Filter by assignee"),
            "them-1",
        );
        expect(await screen.findByText("Rebuild pricing")).toBeInTheDocument();
        expect(screen.queryByText("Migrate the blog")).not.toBeInTheDocument();
    });

    it("offers a way back from a filter that matches nothing", async () => {
        stubQueries("admin");
        const user = userEvent.setup();
        renderPage();

        await screen.findByText("Migrate the blog");
        await user.type(screen.getByLabelText("Search tasks"), "zzzz");

        expect(await screen.findByText("No tasks match")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Clear filters" }));

        expect(await screen.findByText("Migrate the blog")).toBeInTheDocument();
        expect(screen.getByText("Rebuild pricing")).toBeInTheDocument();
    });

    it("finds unassigned work, which is what goes unnoticed", async () => {
        stubQueries("admin");
        const user = userEvent.setup();
        renderPage();

        await screen.findByText("Migrate the blog");
        await user.selectOptions(
            screen.getByLabelText("Filter by assignee"),
            "unassigned",
        );

        expect(await screen.findByText("Migrate the blog")).toBeInTheDocument();
        expect(screen.getByText("Audit performance")).toBeInTheDocument();
        expect(screen.queryByText("Rebuild pricing")).not.toBeInTheDocument();
    });

    it("creates a task as JSON when no files are attached", async () => {
        stubQueries("admin");
        post.mockResolvedValue(makeTask({ title: "New thing" }));
        const user = userEvent.setup();
        renderPage();

        await user.click(
            await screen.findByRole("button", { name: "New task" }),
        );
        await user.type(screen.getByLabelText("Title"), "New thing");
        await user.click(screen.getByRole("button", { name: "Create task" }));

        await waitFor(() => expect(post).toHaveBeenCalled());
        const [path, body] = post.mock.calls[0]!;
        expect(path).toBe("/tasks/project-1");
        expect(body).toMatchObject({
            title: "New thing",
            status: "todo",
            priority: "medium",
            // Nobody picked: sent as null, which the server reads as "none".
            assignedTo: null,
            dueDate: null,
        });
    });

    it("opens the task named in the URL", async () => {
        stubQueries("admin");
        renderWithProviders(
            <Routes>
                <Route
                    path="/projects/:projectId"
                    element={<ProjectDetail />}
                />
            </Routes>,
            { route: "/projects/project-1?task=t-todo" },
        );

        // A deep link is how My tasks, or a teammate, opens one task directly.
        const panel = await screen.findByRole("dialog");
        expect(
            await within(panel).findByText("412 posts, plus redirects."),
        ).toBeInTheDocument();
        expect(get).toHaveBeenCalledWith("/tasks/project-1/t/t-todo");
    });

    it("says why when the server refuses a move", async () => {
        stubQueries("admin");
        put.mockRejectedValue(new ApiError(403, "Not allowed to move that"));
        const user = userEvent.setup();
        renderWithProviders(
            <>
                <Routes>
                    <Route
                        path="/projects/:projectId"
                        element={<ProjectDetail />}
                    />
                </Routes>
                <Toaster />
            </>,
            { route: "/projects/project-1" },
        );

        await user.selectOptions(
            await screen.findByLabelText("Status for Migrate the blog"),
            "done",
        );

        // The card snaps back, and the rollback is no longer silent.
        expect(
            await screen.findByText("Not allowed to move that"),
        ).toBeInTheDocument();
    });

    it("lets a manager rename a subtask in place", async () => {
        stubQueries("admin");
        put.mockResolvedValue({});
        const user = userEvent.setup();
        renderPage();

        await user.click(
            await screen.findByRole("button", { name: "Migrate the blog" }),
        );
        const panel = await screen.findByRole("dialog");
        await user.click(
            within(panel).getByRole("button", {
                name: "Rename subtask Export the posts",
            }),
        );

        const input = within(panel).getByLabelText("Subtask title");
        await user.clear(input);
        await user.type(input, "Export every post{Enter}");

        await waitFor(() =>
            expect(put).toHaveBeenCalledWith("/tasks/project-1/st/s-1", {
                title: "Export every post",
            }),
        );
    });

    it("offers a member no way to rename a subtask", async () => {
        stubQueries("member");
        const user = userEvent.setup();
        renderPage();

        await user.click(
            await screen.findByRole("button", { name: "Migrate the blog" }),
        );
        const panel = await screen.findByRole("dialog");
        // Ticking it off is still theirs to do.
        expect(
            within(panel).getByRole("checkbox", { name: "Export the posts" }),
        ).toBeEnabled();
        expect(
            within(panel).queryByRole("button", { name: /^Rename subtask/ }),
        ).not.toBeInTheDocument();
    });

    it("lets an admin manage every member, including themselves", async () => {
        stubQueries("admin");
        const user = userEvent.setup();
        renderPage();

        await user.click(await screen.findByRole("tab", { name: /Members/ }));

        // The last-admin rule is the server's to enforce (it answers 409), so
        // the UI does not pre-emptively lock an admin out of their own row.
        expect(
            await screen.findByLabelText("Role for Sam Teammate"),
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText("Role for Dana Owner"),
        ).toBeInTheDocument();
        // Distinguishable per member, not a row of identical "Remove"s.
        expect(
            screen.getByRole("button", { name: "Remove Sam Teammate" }),
        ).toBeInTheDocument();
        expect(screen.getByText("you")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Leave project" }),
        ).toBeInTheDocument();
    });

    it("shows a member a read-only roster", async () => {
        stubQueries("member");
        const user = userEvent.setup();
        renderPage();

        await user.click(await screen.findByRole("tab", { name: /Members/ }));

        expect(await screen.findByText("Sam Teammate")).toBeInTheDocument();
        expect(
            screen.queryByLabelText("Role for Sam Teammate"),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Add member" }),
        ).not.toBeInTheDocument();
    });

    it("surfaces the server's refusal to remove the last admin", async () => {
        stubQueries("admin");
        vi.mocked(api.delete).mockRejectedValue(
            new ApiError(409, "A project must keep at least one admin."),
        );
        const user = userEvent.setup();
        renderPage();

        await user.click(await screen.findByRole("tab", { name: /Members/ }));
        await user.click(
            await screen.findByRole("button", { name: "Leave project" }),
        );
        await user.click(screen.getByRole("button", { name: "Leave" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "A project must keep at least one admin.",
        );
    });

    it("surfaces the server's refusal to re-add an existing member", async () => {
        stubQueries("admin");
        vi.mocked(api.post).mockRejectedValue(
            new ApiError(
                409,
                "That person is already a member of this project. Change their role instead.",
            ),
        );
        const user = userEvent.setup();
        renderPage();

        await user.click(await screen.findByRole("tab", { name: /Members/ }));
        // The trigger is replaced by the form, so the second "Add member" is
        // the submit button rather than a duplicate of the first.
        await user.click(
            await screen.findByRole("button", { name: "Add member" }),
        );
        await user.type(screen.getByLabelText("Email"), "dana@example.com");
        await user.click(screen.getByRole("button", { name: "Add member" }));

        /*
         * The API used to accept this and overwrite the person's role, which
         * is how an admin demoted themselves out of their own project. Now it
         * refuses, and the refusal has to say what to do instead -- the role
         * control is a few pixels away on the same screen.
         */
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "already a member of this project",
        );
    });

    it("keeps notes read-only for a project admin", async () => {
        stubQueries("project_admin");
        const user = userEvent.setup();
        renderPage();

        await user.click(await screen.findByRole("tab", { name: /Notes/ }));

        expect(
            await screen.findByText("Launch is gated on pricing."),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "New note" }),
        ).not.toBeInTheDocument();
    });

    it("surfaces a failed load instead of rendering an empty page", async () => {
        get.mockRejectedValue(new ApiError(404, "Project not found"));
        renderPage();

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Project not found",
        );
    });
});
