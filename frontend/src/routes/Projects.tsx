import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { formatDate } from "../lib/display";
import { ROLE_LABELS, type Project, type ProjectListEntry } from "../lib/types";
import {
    Alert,
    Badge,
    Button,
    Card,
    EmptyState,
    Field,
    Skeleton,
} from "../components/ui";

function NewProjectForm({ onDone }: { onDone: () => void }) {
    const queryClient = useQueryClient();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    const mutation = useMutation({
        mutationFn: (input: { name: string; description?: string }) =>
            api.post<Project>("/projects", input),
        onSuccess: () => {
            // The list entry carries a computed member count and the caller's
            // role, neither of which the create response returns -- so refetch
            // rather than trying to splice the new project into the cache.
            void queryClient.invalidateQueries({ queryKey: ["projects"] });
            onDone();
        },
    });

    const error = mutation.error instanceof ApiError ? mutation.error : null;

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        mutation.mutate({
            name: name.trim(),
            description: description.trim() || undefined,
        });
    }

    return (
        <Card className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <p className="text-sm font-medium">New project</p>

                {error && <Alert>{error.message}</Alert>}

                <Field
                    label="Name"
                    name="name"
                    required
                    autoFocus
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    error={error?.fieldErrors.name}
                />

                <Field
                    label="Description"
                    name="description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    hint="Optional."
                    error={error?.fieldErrors.description}
                />

                <div className="flex gap-2">
                    <Button
                        type="submit"
                        size="sm"
                        loading={mutation.isPending}
                        disabled={!name.trim()}
                    >
                        Create project
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={onDone}
                    >
                        Cancel
                    </Button>
                </div>
            </form>
        </Card>
    );
}

function ProjectCard({ entry }: { entry: ProjectListEntry }) {
    const created = formatDate(entry.project.createdAt);
    const members = entry.project.members ?? 0;

    return (
        <Card className="group transition-ui hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-overlay dark:hover:border-indigo-800">
            <Link
                to={`/projects/${entry.project._id}`}
                className="flex h-full flex-col gap-3 rounded-xl p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
                <div className="flex items-start justify-between gap-3">
                    <h2 className="text-heading min-w-0 flex-1 text-strong transition-ui group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {entry.project.name}
                    </h2>
                    {/*
                     * The caller's own role on this project, from the
                     * getProjects aggregation. The detail page re-derives it
                     * from the member list rather than trusting this copy,
                     * which goes stale as soon as an admin changes it.
                     */}
                    <Badge
                        tone={entry.role === "member" ? "neutral" : "accent"}
                    >
                        {ROLE_LABELS[entry.role]}
                    </Badge>
                </div>

                <p className="line-clamp-2 flex-1 text-sm text-muted">
                    {entry.project.description || "No description"}
                </p>

                <div className="flex items-center gap-3 border-t border-hairline pt-3 text-xs text-faint">
                    <span className="inline-flex items-center gap-1.5">
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="size-3.5"
                        >
                            <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 16.29A7.5 7.5 0 0 1 16.535 16.29a.75.75 0 0 1-.64 1.14H4.105a.75.75 0 0 1-.64-1.14Z" />
                        </svg>
                        {members} {members === 1 ? "member" : "members"}
                    </span>
                    {created && <span>Created {created}</span>}
                </div>
            </Link>
        </Card>
    );
}

/** Shaped like the cards it stands in for, so the grid does not jump. */
function ProjectGridSkeleton() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
                <Card key={i} className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                        <Skeleton className="h-4 w-2/5" />
                        <Skeleton className="h-4 w-12" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                    <div className="border-t border-hairline pt-3">
                        <Skeleton className="h-3 w-1/3" />
                    </div>
                </Card>
            ))}
        </div>
    );
}

export function Projects() {
    const [creating, setCreating] = useState(false);

    const { data, isPending, error } = useQuery({
        queryKey: ["projects"],
        queryFn: () => api.get<ProjectListEntry[]>("/projects"),
    });

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-display text-strong">Projects</h1>
                    <p className="mt-1 text-sm text-muted">
                        Projects you own or have been added to.
                    </p>
                </div>
                {!creating && (
                    <Button size="sm" onClick={() => setCreating(true)}>
                        New project
                    </Button>
                )}
            </div>

            {creating && <NewProjectForm onDone={() => setCreating(false)} />}

            {isPending ? (
                <ProjectGridSkeleton />
            ) : error ? (
                <Alert>
                    {error instanceof ApiError
                        ? error.message
                        : "Could not load projects."}
                </Alert>
            ) : data && data.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {data.map((entry) => (
                        <ProjectCard key={entry.project._id} entry={entry} />
                    ))}
                </div>
            ) : (
                <EmptyState
                    title="No projects yet"
                    description="Create a project to start adding tasks, notes, and teammates."
                    action={
                        <Button size="sm" onClick={() => setCreating(true)}>
                            New project
                        </Button>
                    }
                />
            )}
        </div>
    );
}
