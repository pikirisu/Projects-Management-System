import { cx } from "./cx";

/** A horizontal tab strip driven by a controlled value. */
export function Tabs<T extends string>({
    value,
    onChange,
    tabs,
}: {
    value: T;
    onChange: (next: T) => void;
    tabs: Array<{ value: T; label: string; count?: number }>;
}) {
    return (
        <div
            role="tablist"
            className="scrollbar-none flex gap-1 overflow-x-auto border-b border-hairline"
        >
            {tabs.map((tab) => {
                const active = tab.value === value;
                return (
                    <button
                        key={tab.value}
                        role="tab"
                        type="button"
                        aria-selected={active}
                        onClick={() => onChange(tab.value)}
                        className={cx(
                            "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-ui",
                            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
                            active
                                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                                : "border-transparent text-muted hover:border-hairline hover:text-strong",
                        )}
                    >
                        {tab.label}
                        {tab.count !== undefined && (
                            <span
                                className={cx(
                                    "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                                    active
                                        ? "bg-indigo-600/10 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300"
                                        : "bg-sunken text-faint",
                                )}
                            >
                                {tab.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
