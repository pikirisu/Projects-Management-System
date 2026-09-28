import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { asUser, displayName, initials } from "../../lib/display";
import {
    TASK_STATUSES,
    TASK_STATUS_LABELS,
    type ProjectMemberEntry,
    type Task,
    type TaskStatus,
} from "../../lib/types";
import type { Permissions } from "../../routes/ProjectDetail";
import {
    Alert,
    Avatar,
    Button,
    Card,
    EmptyState,
    Field,
    Select,
    Spinner,
    Textarea,
} from "../ui";
import { TaskDetail } from "./TaskDetail";

const COLUMN_ACCENTS: Record<TaskStatus, string> = {
    todo: "bg-neutral-400",
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

                <div className="space-y-1.5">
                    <label
                        htmlFor="attachments"
                        className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                    >
                        Attachments
                    </label>
                    <input
                        id="attachments"
                        type="file"
                        multiple
                        onChange={(event) =>
                            setFiles(
                                Array.from(event.target.files ?? []).slice(
                                    0,
                                    MAX_ATTACHMENTS,
                                ),
                            )
                        }
                        className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-neutral-200 dark:text-neutral-400 dark:file:bg-neutral-800 dark:hover:file:bg-neutral-700"
                    />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Up to {MAX_ATTACHMENTS} files.
                        {files.length > 0 && ` ${files.length} selected.`}
                    </p>
                </div>

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

function TaskCard({
    task,
    projectId,
    can,
    onOpen,
}: {
    task: Task;
    projectId: string;
    can: Permissions;
    onOpen: () => void;
}) {
    const queryClient = useQueryClient();
    const assignee = asUser(task.assignedTo);
    const tasksKey = ["project", projectId, "tasks"];

    /*
     * Optimistic, unlike every other mutation here: moving a card is the one
     * interaction frequent enough that a round trip before the card moves reads
     * as the app ignoring the click. Rolls back to the exact previous list on
     * failure rather than refetching, so a dropped connection cannot leave the
     * board showing a move the server never accepted.
     */
    const statusMutation = useMutation({
        mutationFn: (status: TaskStatus) =>
            api.put<Task>(`/tasks/${projectId}/t/${task._id}`, { status }),
        onMutate: async (status) => {
            await queryClient.cancelQueries({ queryKey: tasksKey });
            const previous = queryClient.getQueryData<Task[]>(tasksKey);
            queryClient.setQueryData<Task[]>(tasksKey, (current) =>
                current?.map((entry) =>
                    entry._id === task._id ? { ...entry, status } : entry,
                ),
            );
            return { previous };
        },
        onError: (_error, _status, context) => {
            if (context?.previous) {
                queryClient.setQueryData(tasksKey, context.previous);
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: tasksKey });
        },
    });

    const attachmentCount = task.attachments?.length ?? 0;

    return (
        <Card className="space-y-2 p-3">
            <button
                type="button"
                onClick={onOpen}
                className="block w-full text-left text-sm font-medium hover:text-indigo-600 dark:hover:text-indigo-400"
            >
                {task.title}
            </button>

            {task.description && (
                <p className="line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">
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
                    <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                        {displayName(assignee)}
                    </span>
                </div>
                {attachmentCount > 0 && (
                    <span className="shrink-0 text-xs text-neutral-400">
                        {attachmentCount} file
                        {attachmentCount === 1 ? "" : "s"}
                    </span>
                )}
            </div>

            {can.manageTasks && (
                <Select
                    aria-label={`Status for ${task.title}`}
                    value={task.status}
                    disabled={statusMutation.isPending}
                    onChange={(event) =>
                        statusMutation.mutate(event.target.value as TaskStatus)
                    }
                    className="!py-1 text-xs"
                    options={TASK_STATUSES.map((value) => ({
                        value,
                        label: TASK_STATUS_LABELS[value],
                    }))}
                />
            )}
        </Card>
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
    const [creating, setCreating] = useState(false);
    const [openTaskId, setOpenTaskId] = useState<string | null>(null);

    if (isPending) {
        return (
            <div className="flex items-center gap-2 py-12 text-sm text-neutral-500 dark:text-neutral-400">
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

    return (
        <div className="space-y-4">
            {can.manageTasks && !creating && (
                <div className="flex justify-end">
                    <Button size="sm" onClick={() => setCreating(true)}>
                        New task
                    </Button>
                </div>
            )}

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
            ) : (
                <div className="grid gap-4 md:grid-cols-3">
                    {TASK_STATUSES.map((status) => {
                        const column = all.filter(
                            (task) => task.status === status,
                        );
                        return (
                            <section key={status} className="space-y-2">
                                <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
                                    <span
                                        aria-hidden="true"
                                        className={`size-1.5 rounded-full ${COLUMN_ACCENTS[status]}`}
                                    />
                                    {TASK_STATUS_LABELS[status]}
                                    <span className="font-normal text-neutral-400">
                                        {column.length}
                                    </span>
                                </h2>

                                {column.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-neutral-200 px-3 py-6 text-center text-xs text-neutral-400 dark:border-neutral-800">
                                        Nothing here
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
