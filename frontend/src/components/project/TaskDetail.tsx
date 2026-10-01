import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useProjectContext } from "../../context/project";
import { api, errorMessage } from "../../lib/api";
import {
    asUser,
    attachmentName,
    displayName,
    formatBytes,
    formatDate,
} from "../../lib/display";
import { invalidateTasks, keys, useTask } from "../../lib/queries";
import {
    TASK_STATUS_LABELS,
    type Attachment,
    type Subtask,
    type TaskDetail as TaskWithSubtasks,
} from "../../lib/types";
import {
    Alert,
    Button,
    ConfirmButton,
    InlineInput,
    SlideOver,
    Skeleton,
    UserAvatar,
} from "../ui";
import { TaskForm } from "./TaskForm";
import { DueChip, PriorityBadge, StatusIcon } from "./TaskMeta";

/**
 * Patches one subtask in the cached task, so a tick shows at once. Returns the
 * previous task for rolling back.
 */
function useSubtaskCache(taskId: string) {
    const { projectId } = useProjectContext();
    const queryClient = useQueryClient();
    const taskKey = keys.task(projectId, taskId);

    return {
        async patch(subtaskId: string, changes: Partial<Subtask>) {
            await queryClient.cancelQueries({ queryKey: taskKey });
            const previous =
                queryClient.getQueryData<TaskWithSubtasks>(taskKey);
            queryClient.setQueryData<TaskWithSubtasks>(
                taskKey,
                (task) =>
                    task && {
                        ...task,
                        subtasks: task.subtasks.map((subtask) =>
                            subtask._id === subtaskId
                                ? { ...subtask, ...changes }
                                : subtask,
                        ),
                    },
            );
            return previous;
        },
        restore(previous?: TaskWithSubtasks) {
            if (previous) queryClient.setQueryData(taskKey, previous);
        },
        refetch() {
            void queryClient.invalidateQueries({ queryKey: taskKey });
        },
    };
}

function SubtaskRow({ subtask, taskId }: { subtask: Subtask; taskId: string }) {
    const { projectId, can } = useProjectContext();
    const cache = useSubtaskCache(taskId);
    const [renaming, setRenaming] = useState(false);
    const [title, setTitle] = useState(subtask.title);
    const path = `/tasks/${projectId}/st/${subtask._id}`;

    // Any member may tick a subtask off; only managers rename or remove one.
    // Ticking is optimistic, with the same rollback as moving a card.
    const toggle = useMutation({
        mutationFn: (isCompleted: boolean) =>
            api.put<Subtask>(path, { isCompleted }),
        onMutate: (isCompleted) => cache.patch(subtask._id, { isCompleted }),
        onError: (error, _value, previous) => {
            cache.restore(previous);
            toast.error(errorMessage(error, "Could not update the subtask"));
        },
        onSettled: cache.refetch,
    });

    const rename = useMutation({
        mutationFn: () => api.put<Subtask>(path, { title: title.trim() }),
        onSuccess: () => {
            setRenaming(false);
            cache.refetch();
        },
        onError: (error) =>
            toast.error(errorMessage(error, "Could not rename the subtask")),
    });

    const remove = useMutation({
        mutationFn: () => api.delete<Subtask>(path),
        onSuccess: cache.refetch,
        onError: (error) =>
            toast.error(errorMessage(error, "Could not remove the subtask")),
    });

    if (renaming) {
        return (
            <li className="py-1.5">
                <form
                    className="flex items-center gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (title.trim()) rename.mutate();
                    }}
                >
                    <InlineInput
                        autoFocus
                        aria-label="Subtask title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Escape") {
                                // Leave the slide-over open; only cancel this.
                                event.stopPropagation();
                                setTitle(subtask.title);
                                setRenaming(false);
                            }
                        }}
                    />
                    <Button
                        type="submit"
                        size="sm"
                        loading={rename.isPending}
                        disabled={!title.trim()}
                    >
                        Save
                    </Button>
                </form>
            </li>
        );
    }

    const author = asUser(subtask.createdBy);

    return (
        <li className="group flex items-center gap-2.5 py-1.5">
            <input
                type="checkbox"
                checked={subtask.isCompleted}
                onChange={(event) => toggle.mutate(event.target.checked)}
                className="size-4 rounded border-hairline accent-indigo-600"
                aria-label={subtask.title}
            />
            <span
                className={
                    subtask.isCompleted
                        ? "flex-1 text-sm text-faint line-through"
                        : "flex-1 text-sm text-strong"
                }
            >
                {subtask.title}
            </span>
            {author && (
                <UserAvatar
                    user={author}
                    size="sm"
                    title={`Added by ${displayName(author)}`}
                />
            )}
            {can.manageTasks && (
                <>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Rename subtask ${subtask.title}`}
                        onClick={() => setRenaming(true)}
                    >
                        <Pencil className="size-3.5" />
                    </Button>
                    <ConfirmButton
                        loading={remove.isPending}
                        onConfirm={() => remove.mutate()}
                        describedAs={`Remove subtask ${subtask.title}`}
                    >
                        Remove
                    </ConfirmButton>
                </>
            )}
        </li>
    );
}

function AddSubtaskForm({ taskId }: { taskId: string }) {
    const { projectId } = useProjectContext();
    const queryClient = useQueryClient();
    const [title, setTitle] = useState("");

    const add = useMutation({
        mutationFn: () =>
            api.post<Subtask>(`/tasks/${projectId}/t/${taskId}/subtasks`, {
                title: title.trim(),
            }),
        onSuccess: () => {
            setTitle("");
            void queryClient.invalidateQueries({
                queryKey: keys.task(projectId, taskId),
            });
        },
    });

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (title.trim()) add.mutate();
    }

    return (
        <form onSubmit={handleSubmit} className="mt-2 flex items-start gap-2">
            <div className="flex-1">
                <InlineInput
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Add a subtask"
                    aria-label="New subtask title"
                />
                {add.isError && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {errorMessage(add.error, "Could not add the subtask")}
                    </p>
                )}
            </div>
            <Button
                type="submit"
                size="sm"
                variant="secondary"
                loading={add.isPending}
                disabled={!title.trim()}
            >
                Add
            </Button>
        </form>
    );
}

function AttachmentRow({ file, taskId }: { file: Attachment; taskId: string }) {
    const { projectId, can } = useProjectContext();
    const queryClient = useQueryClient();
    const name = attachmentName(file.url);
    const size = formatBytes(file.size);

    const remove = useMutation({
        mutationFn: () =>
            api.delete(
                `/tasks/${projectId}/t/${taskId}/attachments/${file._id}`,
            ),
        onSuccess: () => invalidateTasks(queryClient, projectId),
        onError: (error) =>
            toast.error(errorMessage(error, "Could not remove the file")),
    });

    return (
        <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-ui hover:bg-sunken">
            <Paperclip
                className="size-3.5 shrink-0 text-faint"
                aria-hidden="true"
            />
            <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-sm text-indigo-600 hover:underline dark:text-indigo-400"
            >
                {name}
            </a>
            {size && (
                <span className="shrink-0 text-xs text-faint">{size}</span>
            )}
            {/* Rows stored before attachments had ids cannot be addressed. */}
            {can.manageTasks && file._id && (
                <ConfirmButton
                    loading={remove.isPending}
                    onConfirm={() => remove.mutate()}
                    describedAs={`Remove attachment ${name}`}
                >
                    Remove
                </ConfirmButton>
            )}
        </li>
    );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <dt className="text-xs text-faint">{label}</dt>
            <dd className="mt-1 flex items-center gap-2 text-sm text-strong">
                {children}
            </dd>
        </div>
    );
}

function TaskBody({
    task,
    onClose,
}: {
    task: TaskWithSubtasks;
    onClose: () => void;
}) {
    const { projectId, can } = useProjectContext();
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(false);
    const assignee = asUser(task.assignedTo);
    const done = task.subtasks.filter((subtask) => subtask.isCompleted).length;
    const attachments = task.attachments ?? [];

    const remove = useMutation({
        mutationFn: () => api.delete(`/tasks/${projectId}/t/${task._id}`),
        onSuccess: () => {
            invalidateTasks(queryClient, projectId);
            toast.success("Task deleted");
            onClose();
        },
    });

    if (editing) {
        return <TaskForm task={task} onDone={() => setEditing(false)} />;
    }

    return (
        <div className="space-y-7">
            <p className="text-sm whitespace-pre-wrap text-strong">
                {task.description || (
                    <span className="text-faint">No description.</span>
                )}
            </p>

            <dl className="grid grid-cols-2 gap-4 rounded-xl border border-hairline p-4">
                <Detail label="Assignee">
                    <UserAvatar user={assignee} size="sm" />
                    {displayName(assignee)}
                </Detail>
                <Detail label="Status">
                    <StatusIcon status={task.status} />
                    {TASK_STATUS_LABELS[task.status]}
                </Detail>
                <Detail label="Priority">
                    <PriorityBadge task={task} />
                </Detail>
                <Detail label="Due">
                    {task.dueDate ? (
                        <DueChip dueDate={task.dueDate} />
                    ) : (
                        <span className="text-faint">No due date</span>
                    )}
                </Detail>
            </dl>

            {attachments.length > 0 && (
                <section>
                    <h3 className="text-label text-muted">Attachments</h3>
                    <ul className="mt-2 space-y-1">
                        {attachments.map((file, index) => (
                            <AttachmentRow
                                key={file._id ?? `${file.url}-${index}`}
                                file={file}
                                taskId={task._id}
                            />
                        ))}
                    </ul>
                </section>
            )}

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
                    <p className="mt-2 text-sm text-faint">No subtasks yet.</p>
                ) : (
                    <ul className="mt-1 divide-y divide-hairline">
                        {task.subtasks.map((subtask) => (
                            <SubtaskRow
                                key={subtask._id}
                                subtask={subtask}
                                taskId={task._id}
                            />
                        ))}
                    </ul>
                )}
                {can.manageTasks && <AddSubtaskForm taskId={task._id} />}
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
            {remove.isError && (
                <Alert>
                    {errorMessage(remove.error, "Could not delete the task.")}
                </Alert>
            )}
        </div>
    );
}

/** The slide-over for one task. Mounted with `key={taskId}`, so switching tasks starts fresh. */
export function TaskDetail({
    taskId,
    onClose,
}: {
    taskId: string;
    onClose: () => void;
}) {
    const { projectId } = useProjectContext();
    const { data: task, isPending, error } = useTask(projectId, taskId);

    return (
        <SlideOver
            open
            onClose={onClose}
            title={
                <div className="space-y-1">
                    <p className="text-title text-strong">
                        {task?.title ?? "Task"}
                    </p>
                    {task?.createdAt && (
                        <p className="text-xs text-muted">
                            Created {formatDate(task.createdAt)}
                        </p>
                    )}
                </div>
            }
        >
            {isPending ? (
                <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-24 w-full" />
                </div>
            ) : error || !task ? (
                <Alert>
                    {errorMessage(error, "Could not load this task.")}
                </Alert>
            ) : (
                <TaskBody task={task} onClose={onClose} />
            )}
        </SlideOver>
    );
}
