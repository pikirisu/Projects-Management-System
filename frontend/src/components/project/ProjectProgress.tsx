import type { TaskCounts } from "../../lib/types";
import { cx } from "../ui";

/** Done and in-progress share of a project's tasks, as one bar. */
export function ProjectProgress({
    counts,
    className,
}: {
    counts: TaskCounts;
    className?: string;
}) {
    const done = counts.done ?? 0;
    const doing = counts.in_progress ?? 0;
    const total = done + doing + (counts.todo ?? 0);
    const share = (n: number) => `${total ? (n / total) * 100 : 0}%`;

    return (
        <div className={cx("space-y-1.5", className)}>
            <div
                role="progressbar"
                aria-label="Tasks done"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={done}
                className="flex h-1.5 overflow-hidden rounded-full bg-sunken"
            >
                <span
                    className="bg-emerald-500 transition-all"
                    style={{ width: share(done) }}
                />
                <span
                    className="bg-amber-400 transition-all"
                    style={{ width: share(doing) }}
                />
            </div>
            <p className="text-xs text-muted tabular-nums">
                {total === 0
                    ? "No tasks yet"
                    : `${done} of ${total} done${doing ? ` · ${doing} in progress` : ""}`}
            </p>
        </div>
    );
}
