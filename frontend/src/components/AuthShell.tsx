import type { ReactNode } from "react";
import { ApiStatusBanner, useApiWakeup } from "./Layout";

export function AuthShell({
    title,
    subtitle,
    children,
    footer,
}: {
    title: string;
    subtitle: string;
    children: ReactNode;
    footer: ReactNode;
}) {
    const wakeState = useApiWakeup();

    return (
        <div className="flex min-h-full flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
            <ApiStatusBanner state={wakeState} />

            <div className="flex flex-1 items-center justify-center px-4 py-12">
                <div className="w-full max-w-sm">
                    <div className="mb-8 flex items-center gap-2">
                        <span className="grid size-7 place-items-center rounded bg-indigo-600 text-xs font-bold text-white">
                            PC
                        </span>
                        <span className="text-sm font-semibold tracking-tight">
                            Project Camp
                        </span>
                    </div>

                    <h1 className="text-xl font-semibold tracking-tight">
                        {title}
                    </h1>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                        {subtitle}
                    </p>

                    <div className="mt-6">{children}</div>

                    <div className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
                        {footer}
                    </div>
                </div>
            </div>
        </div>
    );
}
