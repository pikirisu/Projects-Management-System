import { useState, type ComponentType } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { FolderKanban, ListChecks, LogOut, Menu, Plus } from "lucide-react";
import { useAuth } from "../context/auth";
import { displayName, projectColor } from "../lib/display";
import { useMyTasks, useProjects } from "../lib/queries";
import { ApiStatusBanner, useApiWakeup } from "./ApiStatusBanner";
import { Logo } from "./Logo";
import { NewProjectDialog } from "./project/NewProjectDialog";
import { ThemeToggle } from "./ThemeToggle";
import { Button, cx, Drawer, UserAvatar } from "./ui";
import { VerifyEmailBanner } from "./VerifyEmailBanner";

const navItemClass = ({ isActive }: { isActive: boolean }) =>
    cx(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-ui",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
        isActive
            ? "bg-sunken text-strong"
            : "text-muted hover:bg-sunken hover:text-strong",
    );

function NavItem({
    to,
    label,
    Icon,
    count,
    end,
    onNavigate,
}: {
    to: string;
    label: string;
    Icon: ComponentType<{ className?: string }>;
    count?: number;
    end?: boolean;
    onNavigate?: () => void;
}) {
    return (
        <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            className={navItemClass}
        >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{label}</span>
            {count !== undefined && count > 0 && (
                <span className="rounded-full bg-indigo-600/10 px-1.5 text-[11px] font-semibold text-indigo-600 tabular-nums dark:bg-indigo-400/15 dark:text-indigo-300">
                    {count}
                </span>
            )}
        </NavLink>
    );
}

function UserMenu({ onNavigate }: { onNavigate?: () => void }) {
    const { user, logout } = useAuth();
    const [signingOut, setSigningOut] = useState(false);
    if (!user) return null;

    return (
        <div className="flex items-center gap-1">
            <Link
                to="/account"
                onClick={onNavigate}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 transition-ui hover:bg-sunken focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
                <UserAvatar user={user} />
                <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-strong">
                        {displayName(user)}
                    </span>
                    <span className="block truncate text-xs text-faint">
                        Account settings
                    </span>
                </span>
            </Link>
            <Button
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                title="Sign out"
                loading={signingOut}
                onClick={() => {
                    setSigningOut(true);
                    void logout().finally(() => setSigningOut(false));
                }}
            >
                {!signingOut && <LogOut className="size-4" />}
            </Button>
        </div>
    );
}

function Sidebar({
    onNavigate,
    onCreateProject,
}: {
    onNavigate?: () => void;
    onCreateProject: () => void;
}) {
    const { data: projects } = useProjects();
    const { data: myTasks } = useMyTasks();
    const openTasks = myTasks?.filter((task) => task.status !== "done").length;

    return (
        <div className="flex h-full w-full flex-col">
            <div className="flex h-14 shrink-0 items-center px-4">
                <Link
                    to="/projects"
                    onClick={onNavigate}
                    className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
                >
                    <Logo />
                </Link>
            </div>

            <nav aria-label="Main" className="space-y-0.5 px-2">
                <NavItem
                    to="/my-tasks"
                    label="My tasks"
                    Icon={ListChecks}
                    count={openTasks}
                    onNavigate={onNavigate}
                />
                <NavItem
                    to="/projects"
                    label="Projects"
                    Icon={FolderKanban}
                    end
                    onNavigate={onNavigate}
                />
            </nav>

            <div className="mt-6 flex items-center justify-between pr-2 pl-4">
                <p className="text-label text-faint">Projects</p>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="New project"
                    title="New project"
                    onClick={onCreateProject}
                >
                    <Plus className="size-4" />
                </Button>
            </div>

            <nav
                aria-label="Projects"
                className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4"
            >
                {projects?.map(({ project }) => (
                    <NavLink
                        key={project._id}
                        to={`/projects/${project._id}`}
                        onClick={onNavigate}
                        className={navItemClass}
                    >
                        <span
                            aria-hidden="true"
                            className="size-2 shrink-0 rounded-sm"
                            style={{
                                backgroundColor: projectColor(project._id),
                            }}
                        />
                        <span className="truncate">{project.name}</span>
                    </NavLink>
                ))}
                {projects?.length === 0 && (
                    <p className="px-2.5 py-1.5 text-xs text-faint">
                        No projects yet.
                    </p>
                )}
            </nav>

            <div className="space-y-2 border-t border-hairline p-2">
                <ThemeToggle className="flex w-full" />
                <UserMenu onNavigate={onNavigate} />
            </div>
        </div>
    );
}

/** The signed-in frame: a sidebar on wide screens, a drawer on narrow ones. */
export function AppShell() {
    const wakeState = useApiWakeup();
    const location = useLocation();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [creating, setCreating] = useState(false);

    const closeDrawer = () => setDrawerOpen(false);
    const createProject = () => {
        setDrawerOpen(false);
        setCreating(true);
    };

    return (
        <div className="min-h-full bg-canvas text-strong">
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-hairline bg-surface lg:flex">
                <Sidebar onCreateProject={createProject} />
            </aside>

            <Drawer open={drawerOpen} onClose={closeDrawer} label="Navigation">
                <Sidebar
                    onNavigate={closeDrawer}
                    onCreateProject={createProject}
                />
            </Drawer>

            <div className="flex min-h-full flex-col lg:pl-60">
                <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-hairline bg-surface/85 px-3 backdrop-blur-md lg:hidden">
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Open navigation"
                        onClick={() => setDrawerOpen(true)}
                    >
                        <Menu className="size-5" />
                    </Button>
                    <Link to="/projects">
                        <Logo />
                    </Link>
                </header>

                <ApiStatusBanner state={wakeState} />

                <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
                    <VerifyEmailBanner />
                    <Outlet key={location.pathname} />
                </main>
            </div>

            <NewProjectDialog
                open={creating}
                onClose={() => setCreating(false)}
            />
        </div>
    );
}
