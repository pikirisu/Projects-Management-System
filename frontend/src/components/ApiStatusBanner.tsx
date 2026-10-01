import { useEffect, useState } from "react";
import { pingApi } from "../lib/api";
import { cx } from "./ui";

type WakeState = "checking" | "awake" | "slow" | "unreachable";

// Decision: a free-tier host sleeps when idle, and the first request then waits
// for a cold start. Probing on mount wakes it before the user's first real
// request, and lets the app say "waking up" instead of looking broken.
export function useApiWakeup(): WakeState {
    const [state, setState] = useState<WakeState>("checking");

    useEffect(() => {
        let settled = false;
        // Only call it slow once a person would notice.
        const slowTimer = window.setTimeout(() => {
            if (!settled) setState("slow");
        }, 2500);

        void pingApi().then((ok) => {
            settled = true;
            window.clearTimeout(slowTimer);
            setState(ok ? "awake" : "unreachable");
        });

        return () => {
            settled = true;
            window.clearTimeout(slowTimer);
        };
    }, []);

    return state;
}

export function ApiStatusBanner({ state }: { state: WakeState }) {
    if (state === "checking" || state === "awake") return null;

    return (
        <div
            role="status"
            className={cx(
                "border-b px-4 py-2 text-center text-xs",
                state === "slow"
                    ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
                    : "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200",
            )}
        >
            {state === "slow"
                ? "Waking the API server. It sleeps when idle, so the first request can take up to a minute."
                : "Cannot reach the API server. It may still be starting; refresh in a moment."}
        </div>
    );
}
