import { Paperclip } from "lucide-react";
import { useProjectContext } from "../../context/project";
import { asUser } from "../../lib/display";
import { useMoveTask } from "../../lib/queries";
import {
    TASK_STATUSES,
    TASK_STATUS_LABELS,
    type Task,
    type TaskStatus,
} from "../../lib/types";
import { Card, cx, Select, UserAvatar } from "../ui";
import { DueChip, PriorityBadge } from "./TaskMeta";

export function TaskCard({
    task,
    dragging,
    onDragStart,
    onDragEnd,
}: {
    task: Task;
    dragging: boolean;
    onDragStart: () => void;
    onDragEnd: () => void;
}) {
    const { projectId, can, openTask } = useProjectContext();
    const move = useMoveTask(projectId);
    const assignee = asUser(task.assignedTo);
    const attachments = task.attachments?.length ?? 0;

    return (
        <Card
            // Only a manager may change a status, so only a manager can drag.
            draggable={can.manageTasks}
            onDragStart={(event) => {
                // Firefox starts no drag without data on the transfer.
                event.dataTransfer.setData("text/plain", task._id);
                event.dataTransfer.effectAllowed = "move";
                onDragStart();
            }}
            onDragEnd={onDragEnd}
            className={cx(
                "group space-y-2.5 p-3.5 transition-ui hover:border-indigo-300 hover:shadow-overlay dark:hover:border-indigo-800",
                can.manageTasks && "cursor-grab active:cursor-grabbing",
                dragging && "opacity-40 shadow-none",
            )}
        >
            <button
                type="button"
                onClick={() => openTask(task._id)}
                className="block w-full text-left text-sm leading-snug font-medium text-strong hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:hover:text-indigo-400"
            >
                {task.title}
            </button>

            {task.description && (
                <p className="line-clamp-2 text-xs text-muted">
                    {task.description}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
                <PriorityBadge task={task} />
                {task.status !== "done" && <DueChip dueDate={task.dueDate} />}
                {attachments > 0 && (
                    <span
                        className="inline-flex items-center gap-0.5 text-[11px] text-faint"
                        title={`${attachments} attachment${attachments === 1 ? "" : "s"}`}
                    >
                        <Paperclip className="size-3" aria-hidden="true" />
                        {attachments}
                    </span>
                )}
                <span className="ml-auto">
                    <UserAvatar user={assignee} size="sm" />
                </span>
            </div>

            {/*
             * The keyboard and touch path for what dragging does with a mouse.
             * Both send the same request.
             */}
            {can.manageTasks && (
                <Select
                    quiet
                    aria-label={`Status for ${task.title}`}
                    value={task.status}
                    disabled={move.isPending}
                    onChange={(event) =>
                        move.mutate({
                            taskId: task._id,
                            status: event.target.value as TaskStatus,
                        })
                    }
                    className="-mx-1 w-auto"
                    options={TASK_STATUSES.map((value) => ({
                        value,
                        label: TASK_STATUS_LABELS[value],
                    }))}
                />
            )}
        </Card>
    );
}
