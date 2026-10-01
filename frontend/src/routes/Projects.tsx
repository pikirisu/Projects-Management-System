import { useState } from "react";
import { Link } from "react-router-dom";
import { FolderKanban, Users } from "lucide-react";
import { errorMessage } from "../lib/api";
import { formatDate, projectColor } from "../lib/display";
import { useProjects } from "../lib/queries";
import { ROLE_LABELS, type ProjectListEntry } from "../lib/types";
import { NewProjectDialog } from "../components/project/NewProjectDialog";
import { ProjectProgress } from "../components/project/ProjectProgress";
import {
    Alert,
    Badge,
    Button,
    Card,
    EmptyState,
    PageHeader,
    Skeleton,
} from "../components/ui";

function ProjectCard({
    entry: { project, role },
}: {
    entry: ProjectListEntry;
}) {
    const created = formatDate(project.createdAt);
    const members = project.members ?? 0;

    return (
        <Card className="group transition-ui hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-overlay dark:hover:border-indigo-800">
            <Link
                to={`/projects/${project._id}`}
                className="flex h-full flex-col gap-4 rounded-xl p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <span
                            aria-hidden="true"
                            className="size-2.5 shrink-0 rounded-sm"
                            style={{
                                backgroundColor: projectColor(project._id),
                            }}
                        />
                        <h2 className="text-heading truncate text-strong transition-ui group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                            {project.name}
                        </h2>
                    </div>
                    {/* The caller's own role, from the getProjects aggregation. */}
                    <Badge tone={role === "member" ? "neutral" : "accent"}>
                        {ROLE_LABELS[role]}
                    </Badge>
                </div>

                <p className="line-clamp-2 flex-1 text-sm text-muted">
                    {project.description || "No description"}
                </p>

                <ProjectProgress counts={project.taskCounts ?? {}} />

                <div className="flex items-center justify-between border-t border-hairline pt-3 text-xs text-faint">
                    <span className="inline-flex items-center gap-1.5">
                        <Users className="size-3.5" aria-hidden="true" />
                        {members} {members === 1 ? "member" : "members"}
                    </span>
                    {created && <span>Created {created}</span>}
                </div>
            </Link>
        </Card>
    );
}

function ProjectGridSkeleton() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
                <Card key={i} className="space-y-4 p-5">
                    <div className="flex justify-between">
                        <Skeleton className="h-4 w-2/5" />
                        <Skeleton className="h-4 w-12" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-1.5 w-full" />
                    <Skeleton className="h-3 w-1/3" />
                </Card>
            ))}
        </div>
    );
}

export function Projects() {
    const [creating, setCreating] = useState(false);
    const { data, isPending, error } = useProjects();

    const newProjectButton = (
        <Button onClick={() => setCreating(true)}>New project</Button>
    );

    return (
        <div className="space-y-6">
            <PageHeader
                title="Projects"
                description="Projects you own or have been added to."
                action={data && data.length > 0 && newProjectButton}
            />

            {isPending ? (
                <ProjectGridSkeleton />
            ) : error ? (
                <Alert>{errorMessage(error, "Could not load projects.")}</Alert>
            ) : data.length === 0 ? (
                <EmptyState
                    icon={<FolderKanban className="size-5" />}
                    title="No projects yet"
                    description="Create a project to start adding tasks, notes and teammates."
                    action={newProjectButton}
                />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {data.map((entry) => (
                        <ProjectCard key={entry.project._id} entry={entry} />
                    ))}
                </div>
            )}

            <NewProjectDialog
                open={creating}
                onClose={() => setCreating(false)}
            />
        </div>
    );
}
