import { useState } from "react";
import { SquareKanban } from "lucide-react";
import { useAuth } from "../../context/auth";
import { useProjectContext } from "../../context/project";
import { errorMessage } from "../../lib/api";
import {
    filterTasks,
    isFiltering,
    NO_FILTERS,
    sortTasks,
    type BoardFilters,
    type PriorityFilter,
    type TaskSort,
} from "../../lib/board";
import { displayName } from "../../lib/display";
import { useMoveTask } from "../../lib/queries";
import {
    TASK_PRIORITIES,
    TASK_PRIORITY_LABELS,
    TASK_STATUSES,
    TASK_STATUS_LABELS,
    type Task,
    type TaskStatus,
} from "../../lib/types";
import {
    Alert,
    Button,
    Card,
    cx,
    Dialog,
    EmptyState,
    InlineInput,
    Select,
    Skeleton,
} from "../ui";
import { TaskCard } from "./TaskCard";
import { TaskForm } from "./TaskForm";
import { STATUS_ACCENTS } from "./TaskMeta";

function BoardSkeleton() {
    return (
        <div className="grid gap-4 md:grid-cols-3">
            {TASK_STATUSES.map((status) => (
                <div key={status} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    {[0, 1].map((i) => (
                        <Card key={i} className="space-y-3 p-3.5">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </Card>
                    ))}
                </div>
            ))}
        </div>
    );
}

function Toolbar({
    filters,
    onFilters,
    sort,
    onSort,
    shown,
    total,
}: {
    filters: BoardFilters;
    onFilters: (next: BoardFilters) => void;
    sort: TaskSort;
    onSort: (next: TaskSort) => void;
    shown: number;
    total: number;
}) {
    const { user } = useAuth();
    const { members } = useProjectContext();
    const update = (patch: Partial<BoardFilters>) =>
        onFilters({ ...filters, ...patch });

    return (
        <div className="flex flex-wrap items-center gap-2">
            <InlineInput
                type="search"
                value={filters.query}
                onChange={(event) => update({ query: event.target.value })}
                placeholder="Search tasks"
                aria-label="Search tasks"
                className="w-full sm:w-52"
            />
            <Select
                aria-label="Filter by assignee"
                value={filters.assignee}
                onChange={(event) => update({ assignee: event.target.value })}
                className="!py-1.5"
                options={[
                    { value: "all", label: "Everyone" },
                    { value: "me", label: "Assigned to me" },
                    { value: "unassigned", label: "Unassigned" },
                    ...members
                        .filter((entry) => entry.user._id !== user?._id)
                        .map((entry) => ({
                            value: entry.user._id,
                            label: displayName(entry.user),
                        })),
                ]}
            />
            <Select
                aria-label="Filter by priority"
                value={filters.priority}
                onChange={(event) =>
                    update({ priority: event.target.value as PriorityFilter })
                }
                className="!py-1.5"
                options={[
                    { value: "all", label: "Any priority" },
                    ...TASK_PRIORITIES.map((value) => ({
                        value,
                        label: `${TASK_PRIORITY_LABELS[value]} priority`,
                    })),
                ]}
            />
            <Select
                aria-label="Sort tasks"
                value={sort}
                onChange={(event) => onSort(event.target.value as TaskSort)}
                className="!py-1.5"
                options={[
                    { value: "newest", label: "Newest first" },
                    { value: "due", label: "Due date" },
                    { value: "priority", label: "Priority" },
                ]}
            />
            {isFiltering(filters) && (
                <p role="status" className="text-xs text-muted">
                    {shown} of {total}
                </p>
            )}
        </div>
    );
}

export function TasksPanel({
    tasks,
    isPending,
    error,
}: {
    tasks?: Task[];
    isPending: boolean;
    error: unknown;
}) {
    const { user } = useAuth();
    const { projectId, can } = useProjectContext();
    const [creating, setCreating] = useState(false);
    const [filters, setFilters] = useState<BoardFilters>(NO_FILTERS);
    const [sort, setSort] = useState<TaskSort>("newest");

    // The dragged card and the column under the pointer live here, not on the
    // card: dataTransfer is unreadable during dragover, which is exactly when
    // a column has to decide whether to highlight.
    const [dragging, setDragging] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
    const move = useMoveTask(projectId);

    if (isPending) return <BoardSkeleton />;
    if (error)
        return <Alert>{errorMessage(error, "Could not load tasks.")}</Alert>;

    const all = tasks ?? [];
    const visible = sortTasks(filterTasks(all, filters, user?._id), sort);
    const draggedTask = all.find((task) => task._id === dragging);

    function drop(status: TaskStatus) {
        const task = draggedTask;
        setDragOver(null);
        setDragging(null);
        // A drop back into the same column changes nothing.
        if (!can.manageTasks || !task || task.status === status) return;
        move.mutate({ taskId: task._id, status });
    }

    const newTaskButton = can.manageTasks && (
        <Button size="sm" onClick={() => setCreating(true)}>
            New task
        </Button>
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                {all.length > 0 ? (
                    <Toolbar
                        filters={filters}
                        onFilters={setFilters}
                        sort={sort}
                        onSort={setSort}
                        shown={visible.length}
                        total={all.length}
                    />
                ) : (
                    <span />
                )}
                {all.length > 0 && newTaskButton}
            </div>

            {all.length === 0 ? (
                <EmptyState
                    icon={<SquareKanban className="size-5" />}
                    title="No tasks yet"
                    description={
                        can.manageTasks
                            ? "Add the first task to start tracking work on this project."
                            : "A project admin has not added any tasks yet."
                    }
                    action={newTaskButton}
                />
            ) : isFiltering(filters) && visible.length === 0 ? (
                <EmptyState
                    title="No tasks match"
                    description="Nothing in this project matches the current search and filters."
                    action={
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setFilters(NO_FILTERS)}
                        >
                            Clear filters
                        </Button>
                    }
                />
            ) : (
                <div className="grid items-start gap-4 md:grid-cols-3">
                    {TASK_STATUSES.map((status) => {
                        const column = visible.filter(
                            (task) => task.status === status,
                        );
                        const receiving =
                            dragOver === status &&
                            draggedTask !== undefined &&
                            draggedTask.status !== status;

                        return (
                            <section
                                key={status}
                                aria-label={TASK_STATUS_LABELS[status]}
                                onDragOver={(event) => {
                                    if (!can.manageTasks || !dragging) return;
                                    // Without this the browser never fires drop.
                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = "move";
                                    setDragOver(status);
                                }}
                                onDragLeave={(event) => {
                                    // Entering a child also fires dragleave.
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
                                    drop(status);
                                }}
                                className={cx(
                                    "min-h-24 space-y-2 rounded-xl bg-sunken/60 p-2 transition-colors",
                                    receiving &&
                                        "bg-indigo-50 ring-2 ring-indigo-300 dark:bg-indigo-950/40 dark:ring-indigo-800",
                                )}
                            >
                                <h2 className="text-label flex items-center gap-2 px-1.5 pt-1 pb-0.5 text-muted">
                                    <span
                                        aria-hidden="true"
                                        className={cx(
                                            "size-1.5 rounded-full",
                                            STATUS_ACCENTS[status],
                                        )}
                                    />
                                    {TASK_STATUS_LABELS[status]}
                                    <span className="ml-auto font-semibold text-faint tabular-nums">
                                        {column.length}
                                    </span>
                                </h2>

                                {column.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-hairline px-3 py-6 text-center text-xs text-faint">
                                        {receiving
                                            ? "Drop to move here"
                                            : "Nothing here"}
                                    </p>
                                ) : (
                                    column.map((task) => (
                                        <TaskCard
                                            key={task._id}
                                            task={task}
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

            <Dialog
                open={creating}
                onClose={() => setCreating(false)}
                title="New task"
            >
                <TaskForm onDone={() => setCreating(false)} />
            </Dialog>
        </div>
    );
}
