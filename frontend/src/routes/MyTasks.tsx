import { useState } from "react";
import { Link } from "react-router-dom";
import { ListChecks } from "lucide-react";
import { errorMessage } from "../lib/api";
import { sortTasks } from "../lib/board";
import { dueStatus, projectColor } from "../lib/display";
import { useMyTasks } from "../lib/queries";
import type { MyTask } from "../lib/types";
import {
    DueChip,
    PriorityBadge,
    StatusIcon,
} from "../components/project/TaskMeta";
import {
    Alert,
    Card,
    cx,
    EmptyState,
    PageHeader,
    Skeleton,
} from "../components/ui";

const GROUPS = [
    { key: "overdue", label: "Overdue" },
    { key: "today", label: "Today" },
    { key: "week", label: "Next 7 days" },
    { key: "later", label: "Later" },
    { key: "none", label: "No due date" },
] as const;

type GroupKey = (typeof GROUPS)[number]["key"];

function groupOf(task: MyTask): GroupKey {
    const due = dueStatus(task.dueDate);
    if (!due) return "none";
    if (due.days < 0) return "overdue";
    if (due.days === 0) return "today";
    return due.days <= 7 ? "week" : "later";
}

function TaskRow({ task }: { task: MyTask }) {
    const done = task.status === "done";
    return (
        <li>
            <Link
                to={`/projects/${task.project._id}?task=${task._id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-ui hover:bg-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600"
            >
                <StatusIcon status={task.status} />
                <span
                    className={cx(
                        "min-w-0 flex-1 truncate text-sm font-medium",
                        done ? "text-faint line-through" : "text-strong",
                    )}
                >
                    {task.title}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                    <span
                        aria-hidden="true"
                        className="size-2 rounded-sm"
                        style={{
                            backgroundColor: projectColor(task.project._id),
                        }}
                    />
                    {task.project.name}
                </span>
                <PriorityBadge task={task} />
                {!done && <DueChip dueDate={task.dueDate} />}
            </Link>
        </li>
    );
}

export function MyTasks() {
    const { data, isPending, error } = useMyTasks();
    const [showDone, setShowDone] = useState(false);

    const tasks = sortTasks(
        (data ?? []).filter((task) => showDone || task.status !== "done"),
        "priority",
    );
    const hiddenDone = (data ?? []).filter((t) => t.status === "done").length;

    return (
        <div className="space-y-6">
            <PageHeader
                title="My tasks"
                description="Everything assigned to you, across every project."
                action={
                    <label className="inline-flex items-center gap-2 text-sm text-muted">
                        <input
                            type="checkbox"
                            checked={showDone}
                            onChange={(event) =>
                                setShowDone(event.target.checked)
                            }
                            className="size-4 accent-indigo-600"
                        />
                        Show completed
                        {hiddenDone > 0 && ` (${hiddenDone})`}
                    </label>
                }
            />

            {isPending ? (
                <Card className="divide-y divide-hairline">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="flex gap-3 px-4 py-3">
                            <Skeleton className="size-4 rounded-full" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    ))}
                </Card>
            ) : error ? (
                <Alert>
                    {errorMessage(error, "Could not load your tasks.")}
                </Alert>
            ) : tasks.length === 0 ? (
                <EmptyState
                    icon={<ListChecks className="size-5" />}
                    title={
                        hiddenDone > 0
                            ? "All caught up"
                            : "Nothing assigned to you"
                    }
                    description={
                        hiddenDone > 0
                            ? "Every task assigned to you is done."
                            : "Tasks a project admin assigns to you will appear here."
                    }
                />
            ) : (
                GROUPS.map(({ key, label }) => {
                    const group = tasks.filter((task) => groupOf(task) === key);
                    if (group.length === 0) return null;
                    return (
                        <section
                            key={key}
                            aria-label={label}
                            className="space-y-2"
                        >
                            <h2
                                className={cx(
                                    "text-label flex items-center gap-2",
                                    key === "overdue"
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-muted",
                                )}
                            >
                                {label}
                                <span className="text-faint tabular-nums">
                                    {group.length}
                                </span>
                            </h2>
                            <Card>
                                <ul className="divide-y divide-hairline">
                                    {group.map((task) => (
                                        <TaskRow key={task._id} task={task} />
                                    ))}
                                </ul>
                            </Card>
                        </section>
                    );
                })
            )}
        </div>
    );
}
