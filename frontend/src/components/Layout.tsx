import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth";
import { pingApi } from "../lib/api";
import { displayName, initials } from "../lib/display";
import { Avatar, Button, cx } from "./ui";
import { VerifyEmailBanner } from "./VerifyEmailBanner";

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

/*
 * This one stays a full-bleed bar above the chrome, unlike the email-verify
 * notice below it. The distinction is deliberate: this reports that the app
 * cannot talk to its server at all, which outranks whatever screen you are on.
 */
export function ApiStatusBanner({ state }: { state: WakeState }) {
    if (state === "checking" || state === "awake") return null;

    return (
        <div
            role="status"
            className={cx(
                "border-b text-center",
                state === "slow"
                    ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
                    : "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200",
            )}
        >
            <p className="mx-auto max-w-6xl px-4 py-2 text-xs sm:px-6">
                {state === "slow"
                    ? "Waking the API server — it sleeps after inactivity on the free tier, so the first request can take up to a minute."
                    : "Cannot reach the API server. It may still be starting up; refresh in a moment."}
            </p>
        </div>
    );
}

const NAV = [{ to: "/projects", label: "Projects" }];

function UserMenu() {
    const { user, logout } = useAuth();
    const [busy, setBusy] = useState(false);

    if (!user) return null;

    return (
        <div className="flex items-center gap-2">
            {/*
             * The avatar is the link. The name and address used to sit in the
             * header as two lines of small type, which read as a paragraph
             * wedged into a toolbar; the name stays on wide screens as a label
             * for the avatar, and the address moves to the account screen that
             * owns it.
             */}
            <Link
                to="/account"
                className="group flex items-center gap-2 rounded-lg px-1.5 py-1 transition-ui hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                title="Account settings"
            >
                <Avatar
                    src={user.avatar?.url}
                    initials={initials(user)}
                    title={displayName(user)}
                />
                <span className="hidden text-sm font-medium text-strong sm:block">
                    {displayName(user)}
                </span>
            </Link>
            <Button
                variant="ghost"
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
        <div className="flex min-h-full flex-col bg-canvas text-strong">
            <ApiStatusBanner state={wakeState} />

            {/*
             * Sticky, so the way back out of a long task board is always one
             * click away rather than one scroll-to-top away. The blur keeps it
             * legible over content without needing an opaque bar that looks
             * detached from the page.
             */}
            <header className="sticky top-0 z-30 border-b border-hairline bg-surface/85 backdrop-blur-md">
                <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
                    <Link
                        to="/projects"
                        className="flex shrink-0 items-center gap-2 rounded-lg text-sm font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
                    >
                        <span className="grid size-6 place-items-center rounded-md bg-indigo-600 text-[11px] font-bold text-white shadow-raised">
                            PC
                        </span>
                        Project Camp
                    </Link>

                    <nav className="flex items-center gap-1">
                        {NAV.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) =>
                                    cx(
                                        "rounded-lg px-2.5 py-1.5 text-sm font-medium transition-ui",
                                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
                                        isActive
                                            ? "bg-sunken text-strong"
                                            : "text-muted hover:bg-sunken hover:text-strong",
                                    )
                                }
                            >
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="ml-auto">
                        <UserMenu />
                    </div>
                </div>
            </header>

            <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:py-10">
                {/*
                 * Inside the content rather than above the header. As a
                 * full-bleed bar it was the loudest element on every screen,
                 * outranking the app's own chrome for a notice about one
                 * account setting.
                 */}
                <VerifyEmailBanner />
                <Outlet key={location.pathname} />
            </main>

            <footer className="border-t border-hairline">
                <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-faint sm:px-6">
                    Project management with per-project role-based access
                    control.
                </p>
            </footer>
        </div>
    );
}
