import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import {
    asUser,
    attachmentName,
    displayName,
    formatBytes,
    formatDate,
    initials,
    refId,
} from "../../lib/display";
import {
    TASK_STATUSES,
    TASK_STATUS_LABELS,
    type Attachment,
    type ProjectMemberEntry,
    type Subtask,
    type TaskDetail as TaskWithSubtasks,
    type TaskStatus,
} from "../../lib/types";
import type { Permissions } from "../../routes/ProjectDetail";
import {
    Alert,
    FileInput,
    InlineInput,
    Avatar,
    Button,
    ConfirmButton,
    Field,
    Select,
    SlideOver,
    Spinner,
    Textarea,
} from "../ui";

function SubtaskRow({
    subtask,
    projectId,
    taskId,
    can,
}: {
    subtask: Subtask;
    projectId: string;
    taskId: string;
    can: Permissions;
}) {
    const queryClient = useQueryClient();
    const taskKey = ["project", projectId, "task", taskId];

    function invalidate() {
        void queryClient.invalidateQueries({ queryKey: taskKey });
    }

    // Any member may tick a subtask off; only managers may rename or remove it.
    // That split lives in updateSubTask on the server -- the UI mirrors it.
    const toggle = useMutation({
        mutationFn: (isCompleted: boolean) =>
            api.put<Subtask>(`/tasks/${projectId}/st/${subtask._id}`, {
                isCompleted,
            }),
        onSuccess: invalidate,
    });

    const remove = useMutation({
        mutationFn: () =>
            api.delete<Subtask>(`/tasks/${projectId}/st/${subtask._id}`),
        onSuccess: invalidate,
    });

    const author = asUser(subtask.createdBy);

    return (
        <li className="flex items-center gap-2 py-1.5">
            <input
                type="checkbox"
                checked={subtask.isCompleted}
                disabled={toggle.isPending}
                onChange={(event) => toggle.mutate(event.target.checked)}
                className="size-4 rounded border-hairline bg-surface text-indigo-600 focus:ring-indigo-600"
                aria-label={subtask.title}
            />
            <span
                className={
                    subtask.isCompleted
                        ? "flex-1 text-sm text-faint line-through"
                        : "flex-1 text-sm"
                }
            >
                {subtask.title}
            </span>
            {author && (
                <Avatar
                    size="sm"
                    src={author.avatar?.url}
                    initials={initials(author)}
                    title={`Added by ${displayName(author)}`}
                />
            )}
            {can.manageTasks && (
                <ConfirmButton
                    loading={remove.isPending}
                    onConfirm={() => remove.mutate()}
                    describedAs={`Remove subtask ${subtask.title}`}
                >
                    Remove
                </ConfirmButton>
            )}
        </li>
    );
}

function AddSubtaskForm({
    projectId,
    taskId,
}: {
    projectId: string;
    taskId: string;
}) {
    const queryClient = useQueryClient();
    const [title, setTitle] = useState("");

    const mutation = useMutation({
        mutationFn: () =>
            api.post<Subtask>(`/tasks/${projectId}/t/${taskId}/subtasks`, {
                title: title.trim(),
            }),
        onSuccess: () => {
            setTitle("");
            void queryClient.invalidateQueries({
                queryKey: ["project", projectId, "task", taskId],
            });
        },
    });

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!title.trim()) return;
        mutation.mutate();
    }

    return (
        <form onSubmit={handleSubmit} className="mt-2 flex items-start gap-2">
            <div className="flex-1">
                <InlineInput
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Add a subtask"
                    aria-label="Subtask title"
                />
                {mutation.error instanceof ApiError && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {mutation.error.message}
                    </p>
                )}
            </div>
            <Button
                type="submit"
                size="sm"
                variant="secondary"
                loading={mutation.isPending}
                disabled={!title.trim()}
            >
                Add
            </Button>
        </form>
    );
}

function AttachmentRow({
    file,
    projectId,
    taskId,
    can,
}: {
    file: Attachment;
    projectId: string;
    taskId: string;
    can: Permissions;
}) {
    const queryClient = useQueryClient();

    const remove = useMutation({
        mutationFn: () =>
            api.delete(
                `/tasks/${projectId}/t/${taskId}/attachments/${file._id}`,
            ),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["project", projectId, "task", taskId],
            });
            // The board shows an attachment count per card.
            void queryClient.invalidateQueries({
                queryKey: ["project", projectId, "tasks"],
            });
        },
    });

    const size = formatBytes(file.size);

    return (
        <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-ui hover:bg-sunken">
            <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-sm text-indigo-600 dark:text-indigo-400"
            >
                {attachmentName(file.url)}
            </a>
            {size && (
                <span className="shrink-0 text-xs text-faint">{size}</span>
            )}
            {/*
             * Only offered for rows the API can actually address. An
             * attachment stored before the schema carried subdocument ids has
             * no _id, and the delete route is keyed on it.
             */}
            {can.manageTasks && file._id && (
                <ConfirmButton
                    loading={remove.isPending}
                    onConfirm={() => remove.mutate()}
                    describedAs={`Remove attachment ${attachmentName(file.url)}`}
                >
                    Remove
                </ConfirmButton>
            )}
            {remove.error instanceof ApiError && (
                <span className="text-xs text-red-600 dark:text-red-400">
                    {remove.error.message}
                </span>
            )}
        </li>
    );
}

function Attachments({
    task,
    projectId,
    can,
}: {
    task: TaskWithSubtasks;
    projectId: string;
    can: Permissions;
}) {
    const files = task.attachments ?? [];
    if (files.length === 0) return null;

    return (
        <section>
            <h3 className="text-label text-muted">Attachments</h3>
            <ul className="mt-2 space-y-1">
                {files.map((file, index) => (
                    <AttachmentRow
                        key={file._id ?? `${file.url}-${index}`}
                        file={file}
                        projectId={projectId}
                        taskId={task._id}
                        can={can}
                    />
                ))}
            </ul>
        </section>
    );
}

function EditTaskForm({
    task,
    projectId,
    members,
    onDone,
}: {
    task: TaskWithSubtasks;
    projectId: string;
    members: ProjectMemberEntry[];
    onDone: () => void;
}) {
    const queryClient = useQueryClient();
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description ?? "");
    const [assignedTo, setAssignedTo] = useState(refId(task.assignedTo) ?? "");
    const [status, setStatus] = useState<TaskStatus>(task.status);
    const [files, setFiles] = useState<File[]>([]);

    const mutation = useMutation({
        mutationFn: () => {
            const path = `/tasks/${projectId}/t/${task._id}`;
            if (files.length === 0) {
                /*
                 * `assignedTo` is omitted rather than sent empty when nobody is
                 * picked: the update validator rejects "" as an invalid Mongo
                 * id, and an absent key simply leaves the field untouched.
                 */
                return api.put<TaskWithSubtasks>(path, {
                    title: title.trim(),
                    description: description.trim(),
                    ...(assignedTo && { assignedTo }),
                    status,
                });
            }

            const form = new FormData();
            form.append("title", title.trim());
            form.append("description", description.trim());
            if (assignedTo) form.append("assignedTo", assignedTo);
            form.append("status", status);
            for (const file of files) form.append("attachments", file);
            return api.put<TaskWithSubtasks>(path, form);
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["project", projectId, "task", task._id],
            });
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
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && <Alert>{error.message}</Alert>}

            <Field
                label="Title"
                name="title"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                error={error?.fieldErrors.title}
            />

            <Textarea
                label="Description"
                name="description"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
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
                label="Add attachments"
                id="more-attachments"
                multiple
                onChange={(event) =>
                    setFiles(Array.from(event.target.files ?? []).slice(0, 5))
                }
            />

            <div className="flex gap-2">
                <Button
                    type="submit"
                    size="sm"
                    loading={mutation.isPending}
                    disabled={!title.trim()}
                >
                    Save changes
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
    );
}

export function TaskDetail({
    projectId,
    taskId,
    can,
    members,
    onClose,
}: {
    projectId: string;
    taskId: string;
    can: Permissions;
    members: ProjectMemberEntry[];
    onClose: () => void;
}) {
    const queryClient = useQueryClient();
    // Reset between tasks comes from the `key` this is mounted with, not from
    // an effect: React discards the whole subtree when the key changes, so
    // `editing` cannot survive into a different task.
    const [editing, setEditing] = useState(false);

    const {
        data: task,
        isPending,
        error,
    } = useQuery({
        queryKey: ["project", projectId, "task", taskId],
        queryFn: () =>
            api.get<TaskWithSubtasks>(`/tasks/${projectId}/t/${taskId}`),
    });

    const remove = useMutation({
        mutationFn: () => api.delete(`/tasks/${projectId}/t/${taskId}`),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["project", projectId, "tasks"],
            });
            onClose();
        },
    });

    const assignee = asUser(task?.assignedTo);
    const done =
        task?.subtasks.filter((entry) => entry.isCompleted).length ?? 0;

    return (
        <SlideOver
            open
            onClose={onClose}
            title={
                <div>
                    <p className="text-sm font-semibold">
                        {task?.title ?? "Task"}
                    </p>
                    {task && (
                        <p className="text-xs text-muted">
                            {TASK_STATUS_LABELS[task.status]}
                            {task.createdAt &&
                                ` · created ${formatDate(task.createdAt)}`}
                        </p>
                    )}
                </div>
            }
        >
            {isPending ? (
                <div className="flex items-center gap-2 text-sm text-muted">
                    <Spinner />
                    Loading task…
                </div>
            ) : error || !task ? (
                <Alert>
                    {error instanceof ApiError
                        ? error.message
                        : "Could not load this task."}
                </Alert>
            ) : editing ? (
                <EditTaskForm
                    task={task}
                    projectId={projectId}
                    members={members}
                    onDone={() => setEditing(false)}
                />
            ) : (
                <div className="space-y-6">
                    <section className="space-y-2">
                        <p className="text-sm whitespace-pre-wrap text-strong">
                            {task.description || "No description."}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted">
                            <Avatar
                                size="sm"
                                src={assignee?.avatar?.url}
                                initials={initials(assignee)}
                                title={displayName(assignee)}
                            />
                            {assignee
                                ? `Assigned to ${displayName(assignee)}`
                                : "Unassigned"}
                        </div>
                    </section>

                    <Attachments task={task} projectId={projectId} can={can} />

                    <section>
                        <h3 className="text-label flex items-center gap-2 text-muted">
                            Subtasks
                            {task.subtasks.length > 0 && (
                                <span className="font-normal normal-case">
                                    {done} of {task.subtasks.length} done
                                </span>
                            )}
                        </h3>

                        {task.subtasks.length === 0 ? (
                            <p className="mt-2 text-sm text-muted">
                                No subtasks yet.
                            </p>
                        ) : (
                            <ul className="mt-1 divide-y divide-hairline">
                                {task.subtasks.map((subtask) => (
                                    <SubtaskRow
                                        key={subtask._id}
                                        subtask={subtask}
                                        projectId={projectId}
                                        taskId={taskId}
                                        can={can}
                                    />
                                ))}
                            </ul>
                        )}

                        {can.manageTasks && (
                            <AddSubtaskForm
                                projectId={projectId}
                                taskId={taskId}
                            />
                        )}
                    </section>

                    {can.manageTasks && (
                        <div className="flex items-center gap-2 border-t border-hairline pt-4">
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setEditing(true)}
                            >
                                Edit task
                            </Button>
                            <ConfirmButton
                                loading={remove.isPending}
                                onConfirm={() => remove.mutate()}
                                confirmLabel="Delete task"
                            >
                                Delete task
                            </ConfirmButton>
                        </div>
                    )}

                    {remove.error instanceof ApiError && (
                        <Alert>{remove.error.message}</Alert>
                    )}
                </div>
            )}
        </SlideOver>
    );
}
