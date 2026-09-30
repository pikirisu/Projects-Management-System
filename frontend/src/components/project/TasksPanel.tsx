import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { asUser, displayName, initials, refId } from "../../lib/display";
import {
    TASK_STATUSES,
    TASK_STATUS_LABELS,
    type ProjectMemberEntry,
    type Task,
    type TaskStatus,
} from "../../lib/types";
import { useAuth } from "../../context/auth";
import type { Permissions } from "../../routes/ProjectDetail";
import {
    Alert,
    Avatar,
    Button,
    Card,
    cx,
    EmptyState,
    Field,
    FileInput,
    InlineInput,
    Select,
    Spinner,
    Textarea,
} from "../ui";
import { TaskDetail } from "./TaskDetail";

const COLUMN_ACCENTS: Record<TaskStatus, string> = {
    todo: "bg-faint",
    in_progress: "bg-amber-500",
    done: "bg-emerald-500",
};

const MAX_ATTACHMENTS = 5;

function NewTaskForm({
    projectId,
    members,
    onDone,
}: {
    projectId: string;
    members: ProjectMemberEntry[];
    onDone: () => void;
}) {
    const queryClient = useQueryClient();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [assignedTo, setAssignedTo] = useState("");
    const [status, setStatus] = useState<TaskStatus>("todo");
    const [files, setFiles] = useState<File[]>([]);

    const mutation = useMutation({
        mutationFn: () => {
            /*
             * JSON unless there are files. Sending multipart unconditionally
             * would work, but every field would then arrive as a string and an
             * empty `assignedTo` would fail the isMongoId validator instead of
             * being skipped as absent.
             */
            if (files.length === 0) {
                return api.post<Task>(`/tasks/${projectId}`, {
                    title: title.trim(),
                    description: description.trim() || undefined,
                    ...(assignedTo && { assignedTo }),
                    status,
                });
            }

            const form = new FormData();
            form.append("title", title.trim());
            if (description.trim())
                form.append("description", description.trim());
            if (assignedTo) form.append("assignedTo", assignedTo);
            form.append("status", status);
            for (const file of files) form.append("attachments", file);
            return api.post<Task>(`/tasks/${projectId}`, form);
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["project", projectId, "tasks"],
            });
            onDone();
        },
    });

    const error = mutation.error instanceof ApiError ? mutation.error : null;

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        mutation.mutate();
    }

    return (
        <Card className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <p className="text-sm font-medium">New task</p>

                {error && <Alert>{error.message}</Alert>}

                <Field
                    label="Title"
                    name="title"
                    required
                    autoFocus
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    error={error?.fieldErrors.title}
                />

                <Textarea
                    label="Description"
                    name="description"
                    rows={3}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    hint="Optional."
                    error={error?.fieldErrors.description}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                    <Select
                        label="Assignee"
                        name="assignedTo"
                        value={assignedTo}
                        onChange={(event) => setAssignedTo(event.target.value)}
                        error={error?.fieldErrors.assignedTo}
                        options={[
                            { value: "", label: "Unassigned" },
                            ...members.map((entry) => ({
                                value: entry.user._id,
                                label: displayName(entry.user),
                            })),
                        ]}
                    />

                    <Select
                        label="Status"
                        name="status"
                        value={status}
                        onChange={(event) =>
                            setStatus(event.target.value as TaskStatus)
                        }
                        error={error?.fieldErrors.status}
                        options={TASK_STATUSES.map((value) => ({
                            value,
                            label: TASK_STATUS_LABELS[value],
                        }))}
                    />
                </div>

                <FileInput
                    label="Attachments"
                    name="attachments"
                    multiple
                    onChange={(event) =>
                        setFiles(
                            Array.from(event.target.files ?? []).slice(
                                0,
                                MAX_ATTACHMENTS,
                            ),
                        )
                    }
                    hint={`Up to ${MAX_ATTACHMENTS} files.${
                        files.length > 0 ? ` ${files.length} selected.` : ""
                    }`}
                />

                <div className="flex gap-2">
                    <Button
                        type="submit"
                        size="sm"
                        loading={mutation.isPending}
                        disabled={!title.trim()}
                    >
                        Create task
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={onDone}
                    >
                        Cancel
                    </Button>
                </div>
            </form>
        </Card>
    );
}

/*
 * Moving a card, by either route. Optimistic, unlike every other mutation
 * here: this is the one interaction frequent enough that a round trip before
 * the card moves reads as the app ignoring the gesture -- and with a drag it
 * would mean the card springing back to where it started. Rolls back to the
 * exact previous list on failure rather than refetching, so a dropped
 * connection cannot leave the board showing a move the server never took.
 *
 * A hook rather than one mutation passed down, so each caller keeps its own
 * isPending: the dropdown on a card disables only that card, and the board's
 * instance answers for drops.
 */
function useMoveTask(projectId: string) {
    const queryClient = useQueryClient();
    const tasksKey = ["project", projectId, "tasks"];

    return useMutation({
        mutationFn: ({
            taskId,
            status,
        }: {
            taskId: string;
            status: TaskStatus;
        }) => api.put<Task>(`/tasks/${projectId}/t/${taskId}`, { status }),
        onMutate: async ({ taskId, status }) => {
            await queryClient.cancelQueries({ queryKey: tasksKey });
            const previous = queryClient.getQueryData<Task[]>(tasksKey);
            queryClient.setQueryData<Task[]>(tasksKey, (current) =>
                current?.map((entry) =>
                    entry._id === taskId ? { ...entry, status } : entry,
                ),
            );
            return { previous };
        },
        onError: (_error, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(tasksKey, context.previous);
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: tasksKey });
        },
    });
}

function TaskCard({
    task,
    projectId,
    can,
    onOpen,
    onDragStart,
    onDragEnd,
    dragging,
}: {
    task: Task;
    projectId: string;
    can: Permissions;
    onOpen: () => void;
    onDragStart: () => void;
    onDragEnd: () => void;
    dragging: boolean;
}) {
    const assignee = asUser(task.assignedTo);
    const statusMutation = useMoveTask(projectId);

    const attachmentCount = task.attachments?.length ?? 0;

    return (
        <Card
            /*
             * Only a manager can drag, because only a manager can change a
             * status -- letting a plain member drag a card that then snapped
             * back on a 403 would be worse than not offering it.
             */
            draggable={can.manageTasks}
            onDragStart={(event) => {
                // Firefox refuses to start a drag without data on the transfer,
                // even though the drop handler reads the id from React state.
                event.dataTransfer.setData("text/plain", task._id);
                event.dataTransfer.effectAllowed = "move";
                onDragStart();
            }}
            onDragEnd={onDragEnd}
            className={cx(
                "space-y-2 p-3.5 transition-ui",
                "hover:border-indigo-300 hover:shadow-overlay dark:hover:border-indigo-800",
                can.manageTasks && "cursor-grab active:cursor-grabbing",
                dragging && "opacity-40 shadow-none",
            )}
        >
            <button
                type="button"
                onClick={onOpen}
                className="block w-full text-left text-sm font-medium hover:text-indigo-600 dark:hover:text-indigo-400"
            >
                {task.title}
            </button>

            {task.description && (
                <p className="line-clamp-2 text-xs text-muted">
                    {task.description}
                </p>
            )}

            <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                    <Avatar
                        size="sm"
                        src={assignee?.avatar?.url}
                        initials={initials(assignee)}
                        title={displayName(assignee)}
                    />
                    <span className="truncate text-xs text-muted">
                        {displayName(assignee)}
                    </span>
                </div>
                {attachmentCount > 0 && (
                    <span className="shrink-0 text-xs text-faint">
                        {attachmentCount} file
                        {attachmentCount === 1 ? "" : "s"}
                    </span>
                )}
            </div>

            {can.manageTasks && (
                <Select
                    quiet
                    aria-label={`Status for ${task.title}`}
                    value={task.status}
                    disabled={statusMutation.isPending}
                    onChange={(event) =>
                        statusMutation.mutate({
                            taskId: task._id,
                            status: event.target.value as TaskStatus,
                        })
                    }
                    className="text-xs"
                    options={TASK_STATUSES.map((value) => ({
                        value,
                        label: TASK_STATUS_LABELS[value],
                    }))}
                />
            )}
        </Card>
    );
}

/** "me" is resolved against the signed-in user, not stored as their id. */
type AssigneeFilter = "all" | "me" | "unassigned" | string;

function matchesAssignee(
    task: Task,
    filter: AssigneeFilter,
    myId: string | undefined,
) {
    if (filter === "all") return true;
    const assigned = refId(task.assignedTo);
    if (filter === "unassigned") return !assigned;
    if (filter === "me") return Boolean(myId) && assigned === myId;
    return assigned === filter;
}

function matchesQuery(task: Task, query: string) {
    if (!query) return true;
    const needle = query.toLowerCase();
    return (
        task.title.toLowerCase().includes(needle) ||
        (task.description ?? "").toLowerCase().includes(needle)
    );
}

export function TasksPanel({
    projectId,
    can,
    members,
    tasks,
    isPending,
    error,
}: {
    projectId: string;
    can: Permissions;
    members: ProjectMemberEntry[];
    tasks?: Task[];
    isPending: boolean;
    error: unknown;
}) {
    const { user } = useAuth();
    const [creating, setCreating] = useState(false);
    const [openTaskId, setOpenTaskId] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [assignee, setAssignee] = useState<AssigneeFilter>("all");

    /*
     * The id of the card being dragged, and the column under the pointer. Both
     * live here rather than on the card: a drop is handled by the column, and
     * the column has to know which card it is receiving. dataTransfer would
     * carry that, but its contents are unreadable during dragover in most
     * browsers -- which is exactly when the highlight has to be decided.
     */
    const [dragging, setDragging] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
    const moveTask = useMoveTask(projectId);

    if (isPending) {
        return (
            <div className="flex items-center gap-2 py-12 text-sm text-muted">
                <Spinner />
                Loading tasks…
            </div>
        );
    }

    if (error) {
        return (
            <Alert>
                {error instanceof ApiError
                    ? error.message
                    : "Could not load tasks."}
            </Alert>
        );
    }

    const all = tasks ?? [];
    const filtering = query.trim().length > 0 || assignee !== "all";
    const visible = all.filter(
        (task) =>
            matchesAssignee(task, assignee, user?._id) &&
            matchesQuery(task, query.trim()),
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                {/*
                 * Filtered in the browser rather than through the API: GET
                 * /tasks/:projectId returns the whole project's tasks in one
                 * response and takes no query parameters, so a round trip per
                 * keystroke would fetch exactly the same rows back.
                 */}
                {all.length > 0 && (
                    <div className="flex flex-wrap items-end gap-2">
                        <div className="w-48">
                            <InlineInput
                                type="search"
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                                placeholder="Search tasks"
                                aria-label="Search tasks"
                            />
                        </div>
                        <div className="w-44">
                            <Select
                                aria-label="Filter by assignee"
                                value={assignee}
                                onChange={(event) =>
                                    setAssignee(event.target.value)
                                }
                                className="!py-1.5"
                                options={[
                                    { value: "all", label: "Everyone" },
                                    { value: "me", label: "Assigned to me" },
                                    {
                                        value: "unassigned",
                                        label: "Unassigned",
                                    },
                                    ...members
                                        .filter(
                                            (entry) =>
                                                entry.user._id !== user?._id,
                                        )
                                        .map((entry) => ({
                                            value: entry.user._id,
                                            label: displayName(entry.user),
                                        })),
                                ]}
                            />
                        </div>
                        {filtering && (
                            <p
                                role="status"
                                className="pb-1.5 text-xs text-muted"
                            >
                                {visible.length} of {all.length}
                            </p>
                        )}
                    </div>
                )}

                {can.manageTasks && !creating && (
                    <Button size="sm" onClick={() => setCreating(true)}>
                        New task
                    </Button>
                )}
            </div>

            {creating && (
                <NewTaskForm
                    projectId={projectId}
                    members={members}
                    onDone={() => setCreating(false)}
                />
            )}

            {all.length === 0 ? (
                <EmptyState
                    title="No tasks yet"
                    description={
                        can.manageTasks
                            ? "Add the first task to start tracking work on this project."
                            : "A project admin has not added any tasks yet."
                    }
                    action={
                        can.manageTasks && !creating ? (
                            <Button size="sm" onClick={() => setCreating(true)}>
                                New task
                            </Button>
                        ) : undefined
                    }
                />
            ) : filtering && visible.length === 0 ? (
                <EmptyState
                    title="No tasks match"
                    description="Nothing in this project matches the current search and assignee filter."
                    action={
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                                setQuery("");
                                setAssignee("all");
                            }}
                        >
                            Clear filters
                        </Button>
                    }
                />
            ) : (
                <div className="grid gap-4 md:grid-cols-3">
                    {TASK_STATUSES.map((status) => {
                        const column = visible.filter(
                            (task) => task.status === status,
                        );
                        const dragged = dragging
                            ? all.find((task) => task._id === dragging)
                            : undefined;
                        // Nothing to drop here if the card already lives here.
                        const receiving =
                            dragOver === status &&
                            dragged !== undefined &&
                            dragged.status !== status;

                        return (
                            <section
                                key={status}
                                /*
                                 * A <section> is only a landmark once it has a
                                 * name, so without this the board was three
                                 * unlabelled boxes to a screen reader -- and
                                 * there was no way to address a column at all.
                                 */
                                aria-label={TASK_STATUS_LABELS[status]}
                                onDragOver={(event) => {
                                    if (!can.manageTasks || !dragging) return;
                                    // Without preventDefault the browser treats
                                    // this as a non-drop target and no drop
                                    // event is ever delivered.
                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = "move";
                                    setDragOver(status);
                                }}
                                onDragLeave={(event) => {
                                    // Moving onto a child fires dragleave on the
                                    // section; ignore anything still inside it.
                                    if (
                                        event.currentTarget.contains(
                                            event.relatedTarget as Node | null,
                                        )
                                    ) {
                                        return;
                                    }
                                    setDragOver((current) =>
                                        current === status ? null : current,
                                    );
                                }}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    setDragOver(null);
                                    const taskId =
                                        dragging ||
                                        event.dataTransfer.getData(
                                            "text/plain",
                                        );
                                    setDragging(null);
                                    if (!taskId || !can.manageTasks) return;
                                    const task = all.find(
                                        (entry) => entry._id === taskId,
                                    );
                                    // A drop back into the same column is a
                                    // no-op, not a request the server needs.
                                    if (!task || task.status === status) return;
                                    moveTask.mutate({ taskId, status });
                                }}
                                className={cx(
                                    "space-y-2 rounded-lg transition-colors",
                                    receiving &&
                                        "bg-indigo-50/70 ring-1 ring-indigo-200 dark:bg-indigo-950/30 dark:ring-indigo-900",
                                )}
                            >
                                <h2 className="text-label flex items-center gap-2 px-0.5 text-muted">
                                    <span
                                        aria-hidden="true"
                                        className={`size-1.5 rounded-full ${COLUMN_ACCENTS[status]}`}
                                    />
                                    {TASK_STATUS_LABELS[status]}
                                    <span className="rounded-full bg-sunken px-1.5 py-0.5 font-semibold text-faint tabular-nums">
                                        {column.length}
                                    </span>
                                </h2>

                                {column.length === 0 ? (
                                    <p className="rounded-xl border border-dashed border-hairline px-3 py-8 text-center text-xs text-faint">
                                        {receiving
                                            ? "Drop to move here"
                                            : "Nothing here"}
                                    </p>
                                ) : (
                                    column.map((task) => (
                                        <TaskCard
                                            key={task._id}
                                            task={task}
                                            projectId={projectId}
                                            can={can}
                                            onOpen={() =>
                                                setOpenTaskId(task._id)
                                            }
                                            dragging={dragging === task._id}
                                            onDragStart={() =>
                                                setDragging(task._id)
                                            }
                                            onDragEnd={() => {
                                                setDragging(null);
                                                setDragOver(null);
                                            }}
                                        />
                                    ))
                                )}
                            </section>
                        );
                    })}
                </div>
            )}

            {openTaskId && (
                <TaskDetail
                    key={openTaskId}
                    projectId={projectId}
                    taskId={openTaskId}
                    can={can}
                    members={members}
                    onClose={() => setOpenTaskId(null)}
                />
            )}
        </div>
    );
}
