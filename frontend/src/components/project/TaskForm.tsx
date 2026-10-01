import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, asApiError } from "../../lib/api";
import { priorityOf } from "../../lib/board";
import { MAX_ATTACHMENTS } from "../../lib/constants";
import { displayName, refId, toDateInput } from "../../lib/display";
import { invalidateTasks } from "../../lib/queries";
import {
    TASK_PRIORITIES,
    TASK_PRIORITY_LABELS,
    TASK_STATUSES,
    TASK_STATUS_LABELS,
    type Task,
    type TaskPriority,
    type TaskStatus,
} from "../../lib/types";
import { useProjectContext } from "../../context/project";
import { Alert, Button, Field, FileInput, Select, Textarea } from "../ui";

export interface TaskFields {
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    /** "" for nobody. */
    assignedTo: string;
    /** "YYYY-MM-DD", or "" for no due date. */
    dueDate: string;
}

const fieldsFrom = (task?: Task): TaskFields => ({
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? "todo",
    priority: task ? priorityOf(task) : "medium",
    assignedTo: refId(task?.assignedTo) ?? "",
    dueDate: toDateInput(task?.dueDate),
});

// Decision: JSON unless files are attached. Multipart sends every field as a
// string, so there "" means "clear"; JSON can say null. Either way the server
// clears the assignee or due date, which is how a task is unassigned.
export function buildTaskPayload(
    fields: TaskFields,
    files: File[],
): Record<string, string | null> | FormData {
    const values = {
        title: fields.title.trim(),
        description: fields.description.trim(),
        status: fields.status,
        priority: fields.priority,
        assignedTo: fields.assignedTo || null,
        dueDate: fields.dueDate || null,
    };
    if (files.length === 0) return values;

    const form = new FormData();
    for (const [key, value] of Object.entries(values)) {
        form.append(key, value ?? "");
    }
    for (const file of files) form.append("attachments", file);
    return form;
}

const options = <T extends string>(
    values: readonly T[],
    labels: Record<T, string>,
) => values.map((value) => ({ value, label: labels[value] }));

/** Creates a task, or edits `task` when one is given. */
export function TaskForm({
    task,
    onDone,
}: {
    task?: Task;
    onDone: () => void;
}) {
    const { projectId, members } = useProjectContext();
    const queryClient = useQueryClient();
    const [fields, setFields] = useState<TaskFields>(() => fieldsFrom(task));
    const [files, setFiles] = useState<File[]>([]);

    const set =
        <K extends keyof TaskFields>(key: K) =>
        (value: TaskFields[K]) =>
            setFields((current) => ({ ...current, [key]: value }));

    const save = useMutation({
        mutationFn: () => {
            const body = buildTaskPayload(fields, files);
            return task
                ? api.put<Task>(`/tasks/${projectId}/t/${task._id}`, body)
                : api.post<Task>(`/tasks/${projectId}`, body);
        },
        onSuccess: () => {
            invalidateTasks(queryClient, projectId);
            toast.success(task ? "Task updated" : "Task created");
            onDone();
        },
    });

    const error = asApiError(save.error);

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        save.mutate();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && <Alert>{error.message}</Alert>}

            <Field
                label="Title"
                name="title"
                required
                autoFocus={!task}
                value={fields.title}
                onChange={(event) => set("title")(event.target.value)}
                error={error?.fieldErrors.title}
            />

            <Textarea
                label="Description"
                name="description"
                rows={4}
                value={fields.description}
                onChange={(event) => set("description")(event.target.value)}
                hint={task ? undefined : "Optional."}
            />

            <div className="grid gap-4 sm:grid-cols-2">
                <Select
                    label="Assignee"
                    name="assignedTo"
                    value={fields.assignedTo}
                    onChange={(event) => set("assignedTo")(event.target.value)}
                    error={error?.fieldErrors.assignedTo}
                    options={[
                        { value: "", label: "Unassigned" },
                        ...members.map(({ user }) => ({
                            value: user._id,
                            label: displayName(user),
                        })),
                    ]}
                />
                <Field
                    label="Due date"
                    name="dueDate"
                    type="date"
                    value={fields.dueDate}
                    onChange={(event) => set("dueDate")(event.target.value)}
                    error={error?.fieldErrors.dueDate}
                />
                <Select
                    label="Status"
                    name="status"
                    value={fields.status}
                    onChange={(event) =>
                        set("status")(event.target.value as TaskStatus)
                    }
                    options={options(TASK_STATUSES, TASK_STATUS_LABELS)}
                />
                <Select
                    label="Priority"
                    name="priority"
                    value={fields.priority}
                    onChange={(event) =>
                        set("priority")(event.target.value as TaskPriority)
                    }
                    options={options(TASK_PRIORITIES, TASK_PRIORITY_LABELS)}
                />
            </div>

            <FileInput
                label={task ? "Add attachments" : "Attachments"}
                id="task-attachments"
                multiple
                onChange={(event) =>
                    setFiles(
                        Array.from(event.target.files ?? []).slice(
                            0,
                            MAX_ATTACHMENTS,
                        ),
                    )
                }
                hint={`Images, PDFs or text, up to ${MAX_ATTACHMENTS} files of 1 MB.${
                    files.length > 0 ? ` ${files.length} selected.` : ""
                }`}
            />

            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onDone}>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    loading={save.isPending}
                    disabled={!fields.title.trim()}
                >
                    {task ? "Save changes" : "Create task"}
                </Button>
            </div>
        </form>
    );
}
