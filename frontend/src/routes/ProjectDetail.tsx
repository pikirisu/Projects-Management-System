import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useAuth } from "../context/auth";
import { ProjectContext } from "../context/project";
import { errorMessage } from "../lib/api";
import { formatDate, projectColor } from "../lib/display";
import { permissionsFor } from "../lib/permissions";
import { useMembers, useNotes, useProject, useTasks } from "../lib/queries";
import { ROLE_LABELS, type TaskCounts } from "../lib/types";
import { MembersPanel } from "../components/project/MembersPanel";
import { NotesPanel } from "../components/project/NotesPanel";
import { ProjectProgress } from "../components/project/ProjectProgress";
import { ProjectSettings } from "../components/project/ProjectSettings";
import { TaskDetail } from "../components/project/TaskDetail";
import { TasksPanel } from "../components/project/TasksPanel";
import { Alert, AvatarStack, Badge, Skeleton, Tabs } from "../components/ui";

type TabKey = "tasks" | "notes" | "members" | "settings";

function Breadcrumb({ name }: { name?: string }) {
    return (
        <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1 text-sm text-muted"
        >
            <Link to="/projects" className="hover:text-strong">
                Projects
            </Link>
            {name && (
                <>
                    <ChevronRight
                        className="size-3.5 text-faint"
                        aria-hidden="true"
                    />
                    <span className="truncate text-strong">{name}</span>
                </>
            )}
        </nav>
    );
}

export function ProjectDetail() {
    const { projectId = "" } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const [tab, setTab] = useState<TabKey>("tasks");

    const projectQuery = useProject(projectId);
    // The member list is also the source of the caller's own role: it is
    // needed anyway for assignees, and unlike the cached project list it is
    // never stale after an admin changes someone's role.
    const membersQuery = useMembers(projectId);
    const tasksQuery = useTasks(projectId);
    const notesQuery = useNotes(projectId);

    const members = membersQuery.data;
    const myRole =
        members?.find((entry) => entry.user._id === user?._id)?.role ?? null;

    // A task's slide-over is driven by ?task=, so a task has a shareable URL
    // and My tasks can link straight to one.
    const openTaskId = searchParams.get("task");

    const context = useMemo(
        () => ({
            projectId,
            can: permissionsFor(myRole),
            members: members ?? [],
            openTask: (taskId: string) => setSearchParams({ task: taskId }),
        }),
        [projectId, myRole, members, setSearchParams],
    );

    if (projectQuery.isPending) {
        return (
            <div className="space-y-4">
                <Breadcrumb />
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 max-w-full" />
            </div>
        );
    }

    if (projectQuery.error || !projectQuery.data) {
        return (
            <div className="space-y-4">
                <Breadcrumb />
                <Alert>
                    {errorMessage(
                        projectQuery.error,
                        "Could not load this project.",
                    )}
                </Alert>
            </div>
        );
    }

    const project = projectQuery.data;
    const created = formatDate(project.createdAt);
    const counts: TaskCounts = {};
    for (const task of tasksQuery.data ?? []) {
        counts[task.status] = (counts[task.status] ?? 0) + 1;
    }

    return (
        <ProjectContext value={context}>
            <div className="space-y-6">
                <div className="space-y-4">
                    <Breadcrumb name={project.name} />

                    <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
                        <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-3">
                                <span
                                    aria-hidden="true"
                                    className="size-3 rounded"
                                    style={{
                                        backgroundColor: projectColor(
                                            project._id,
                                        ),
                                    }}
                                />
                                <h1 className="text-display text-strong">
                                    {project.name}
                                </h1>
                                {myRole && (
                                    <Badge
                                        tone={
                                            myRole === "member"
                                                ? "neutral"
                                                : "accent"
                                        }
                                    >
                                        {ROLE_LABELS[myRole]}
                                    </Badge>
                                )}
                            </div>
                            <p className="max-w-2xl text-sm text-muted">
                                {project.description || "No description"}
                            </p>
                        </div>

                        <div className="flex items-center gap-6">
                            {members && (
                                <AvatarStack
                                    users={members.map((entry) => entry.user)}
                                />
                            )}
                            {tasksQuery.data && (
                                <ProjectProgress
                                    counts={counts}
                                    className="w-44"
                                />
                            )}
                        </div>
                    </div>
                    {created && (
                        <p className="text-xs text-faint">Created {created}</p>
                    )}
                </div>

                <Tabs
                    value={tab}
                    onChange={setTab}
                    tabs={[
                        {
                            value: "tasks",
                            label: "Tasks",
                            count: tasksQuery.data?.length,
                        },
                        {
                            value: "notes",
                            label: "Notes",
                            count: notesQuery.data?.length,
                        },
                        {
                            value: "members",
                            label: "Members",
                            count: members?.length,
                        },
                        ...(context.can.manageProject
                            ? [
                                  {
                                      value: "settings" as const,
                                      label: "Settings",
                                  },
                              ]
                            : []),
                    ]}
                />

                {tab === "tasks" && (
                    <TasksPanel
                        tasks={tasksQuery.data}
                        isPending={tasksQuery.isPending}
                        error={tasksQuery.error}
                    />
                )}
                {tab === "notes" && (
                    <NotesPanel
                        notes={notesQuery.data}
                        isPending={notesQuery.isPending}
                        error={notesQuery.error}
                    />
                )}
                {tab === "members" && (
                    <MembersPanel
                        isPending={membersQuery.isPending}
                        error={membersQuery.error}
                    />
                )}
                {tab === "settings" && context.can.manageProject && (
                    <ProjectSettings project={project} />
                )}
            </div>

            {openTaskId && (
                <TaskDetail
                    key={openTaskId}
                    taskId={openTaskId}
                    onClose={() => setSearchParams({})}
                />
            )}
        </ProjectContext>
    );
}
