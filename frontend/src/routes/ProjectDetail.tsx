import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { formatDate } from "../lib/display";
import {
    ROLE_LABELS,
    type Note,
    type Project,
    type ProjectMemberEntry,
    type Role,
    type Task,
} from "../lib/types";
import { useAuth } from "../context/auth";
import { Alert, Badge, Spinner, Tabs } from "../components/ui";
import { TasksPanel } from "../components/project/TasksPanel";
import { NotesPanel } from "../components/project/NotesPanel";
import { MembersPanel } from "../components/project/MembersPanel";
import { ProjectSettings } from "../components/project/ProjectSettings";

type TabKey = "tasks" | "notes" | "members" | "settings";

/**
 * What the current user may do here. The server enforces all of it in
 * validateProjectPermission; this only decides what the UI bothers to offer,
 * so a stale value costs a 403 rather than unauthorized access.
 */
export interface Permissions {
    manageTasks: boolean;
    manageProject: boolean;
}

export function permissionsFor(role: Role | null): Permissions {
    return {
        manageTasks: role === "admin" || role === "project_admin",
        manageProject: role === "admin",
    };
}

function errorMessage(error: unknown, fallback: string) {
    return error instanceof ApiError ? error.message : fallback;
}

export function ProjectDetail() {
    const { projectId = "" } = useParams();
    const { user } = useAuth();
    const [tab, setTab] = useState<TabKey>("tasks");

    const projectQuery = useQuery({
        queryKey: ["project", projectId],
        queryFn: () => api.get<Project>(`/projects/${projectId}`),
    });

    /*
     * The members list doubles as the source of the caller's own role: no
     * endpoint returns "my role on this project" directly, and the cached
     * /projects entry goes stale the moment an admin changes it. This list is
     * needed anyway for the assignee picker, so reading the role from it is
     * free and always current.
     */
    const membersQuery = useQuery({
        queryKey: ["project", projectId, "members"],
        queryFn: () =>
            api.get<ProjectMemberEntry[]>(`/projects/${projectId}/members`),
    });

    const tasksQuery = useQuery({
        queryKey: ["project", projectId, "tasks"],
        queryFn: () => api.get<Task[]>(`/tasks/${projectId}`),
    });

    const notesQuery = useQuery({
        queryKey: ["project", projectId, "notes"],
        queryFn: () => api.get<Note[]>(`/notes/${projectId}`),
    });

    const myRole =
        membersQuery.data?.find((entry) => entry.user._id === user?._id)
            ?.role ?? null;
    const can = permissionsFor(myRole);

    if (projectQuery.isPending) {
        return (
            <div className="flex items-center gap-2 py-12 text-sm text-muted">
                <Spinner />
                Loading project…
            </div>
        );
    }

    if (projectQuery.error || !projectQuery.data) {
        return (
            <div className="space-y-4">
                <Link
                    to="/projects"
                    className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                >
                    ← All projects
                </Link>
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

    return (
        <div className="space-y-6">
            <div>
                <Link
                    to="/projects"
                    className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                >
                    ← All projects
                </Link>

                <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
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
                        <p className="mt-1.5 text-sm text-muted">
                            {project.description || "No description"}
                        </p>
                        {created && (
                            <p className="mt-1 text-xs text-faint">
                                Created {created}
                            </p>
                        )}
                    </div>
                </div>
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
                        count: membersQuery.data?.length,
                    },
                    ...(can.manageProject
                        ? [{ value: "settings" as const, label: "Settings" }]
                        : []),
                ]}
            />

            {tab === "tasks" && (
                <TasksPanel
                    projectId={projectId}
                    can={can}
                    members={membersQuery.data ?? []}
                    tasks={tasksQuery.data}
                    isPending={tasksQuery.isPending}
                    error={tasksQuery.error}
                />
            )}

            {tab === "notes" && (
                <NotesPanel
                    projectId={projectId}
                    can={can}
                    notes={notesQuery.data}
                    isPending={notesQuery.isPending}
                    error={notesQuery.error}
                />
            )}

            {tab === "members" && (
                <MembersPanel
                    projectId={projectId}
                    can={can}
                    members={membersQuery.data}
                    isPending={membersQuery.isPending}
                    error={membersQuery.error}
                />
            )}

            {tab === "settings" && can.manageProject && (
                <ProjectSettings project={project} />
            )}
        </div>
    );
}
