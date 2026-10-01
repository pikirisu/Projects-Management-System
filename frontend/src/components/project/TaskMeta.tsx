import {
    CalendarDays,
    Circle,
    CircleCheck,
    CircleDot,
    SignalHigh,
    SignalLow,
    SignalMedium,
} from "lucide-react";
import { priorityOf } from "../../lib/board";
import { dueStatus, type DueTone } from "../../lib/display";
import {
    TASK_PRIORITY_LABELS,
    TASK_STATUS_LABELS,
    type Task,
    type TaskStatus,
} from "../../lib/types";
import { Badge, cx, type BadgeTone } from "../ui";

const PRIORITY_STYLE = {
    high: { Icon: SignalHigh, tone: "danger" },
    medium: { Icon: SignalMedium, tone: "warning" },
    low: { Icon: SignalLow, tone: "neutral" },
} as const;

export function PriorityBadge({ task }: { task: Pick<Task, "priority"> }) {
    const priority = priorityOf(task);
    const { Icon, tone } = PRIORITY_STYLE[priority];
    return (
        <Badge tone={tone}>
            <Icon className="size-3" aria-hidden="true" />
            {TASK_PRIORITY_LABELS[priority]}
        </Badge>
    );
}

const DUE_TONES: Record<DueTone, BadgeTone> = {
    overdue: "danger",
    today: "warning",
    soon: "accent",
    later: "neutral",
};

/** How far off a due date is, coloured by urgency; nothing without one. */
export function DueChip({ dueDate }: { dueDate?: string | null }) {
    const due = dueStatus(dueDate);
    if (!due) return null;
    return (
        <Badge tone={DUE_TONES[due.tone]}>
            <CalendarDays className="size-3" aria-hidden="true" />
            {due.label}
        </Badge>
    );
}

const STATUS_ICONS = {
    todo: { Icon: Circle, className: "text-faint" },
    in_progress: { Icon: CircleDot, className: "text-amber-500" },
    done: { Icon: CircleCheck, className: "text-emerald-500" },
};

export function StatusIcon({ status }: { status: TaskStatus }) {
    const { Icon, className } = STATUS_ICONS[status];
    return (
        <Icon
            className={cx("size-4 shrink-0", className)}
            aria-label={TASK_STATUS_LABELS[status]}
        />
    );
}

/** The dot each board column is headed by. */
export const STATUS_ACCENTS: Record<TaskStatus, string> = {
    todo: "bg-faint",
    in_progress: "bg-amber-500",
    done: "bg-emerald-500",
};
