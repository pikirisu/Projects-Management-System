import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth";
import { pingApi } from "../lib/api";
import { Button } from "./ui";

/*
 * A free-tier host suspends the service after a stretch of inactivity, and the
 * first request then waits for a cold start. Without a signal for that, the app
 * looks broken for up to a minute. Probing on mount both wakes the server
 * before the user's first real request and gives us something honest to show.
 */
type WakeState = "checking" | "awake" | "slow" | "unreachable";

export function useApiWakeup(): WakeState {
    const [state, setState] = useState<WakeState>("checking");

    useEffect(() => {
        let settled = false;
        // Only call it "slow" once it is slow enough for a person to notice.
        const slowTimer = window.setTimeout(() => {
            if (!settled) setState("slow");
        }, 2500);

        pingApi().then((ok) => {
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
            className={
                state === "slow"
                    ? "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
                    : "bg-red-50 text-red-900 dark:bg-red-950/50 dark:text-red-200"
            }
        >
            <p className="mx-auto max-w-5xl px-4 py-2 text-xs sm:px-6">
                {state === "slow"
                    ? "Waking the API server — it sleeps after inactivity on the free tier, so the first request can take up to a minute."
                    : "Cannot reach the API server. It may still be starting up; refresh in a moment."}
            </p>
        </div>
    );
}

function UserMenu() {
    const { user, logout } = useAuth();
    const [busy, setBusy] = useState(false);

    if (!user) return null;

    return (
        <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
                <p className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                    {user.fullName || user.username}
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {user.email}
                </p>
            </div>
            <Button
                variant="secondary"
                size="sm"
                loading={busy}
                onClick={() => {
                    setBusy(true);
                    void logout().finally(() => setBusy(false));
                }}
            >
                Sign out
            </Button>
        </div>
    );
}

export function Layout() {
    const wakeState = useApiWakeup();
    const location = useLocation();

    return (
        <div className="flex min-h-full flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
            <ApiStatusBanner state={wakeState} />

            <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
                    <Link
                        to="/projects"
                        className="flex items-center gap-2 text-sm font-semibold tracking-tight"
                    >
                        <span className="grid size-6 place-items-center rounded bg-indigo-600 text-[11px] font-bold text-white">
                            PC
                        </span>
                        Project Camp
                    </Link>
                    <UserMenu />
                </div>
            </header>

            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
                <Outlet key={location.pathname} />
            </main>

            <footer className="border-t border-neutral-200 py-4 dark:border-neutral-800">
                <p className="mx-auto max-w-5xl px-4 text-xs text-neutral-500 sm:px-6 dark:text-neutral-400">
                    Project management with per-project role-based access
                    control.
                </p>
            </footer>
        </div>
    );
}
