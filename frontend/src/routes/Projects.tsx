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
    Spinner,
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

function ProjectRow({ entry }: { entry: ProjectListEntry }) {
    const created = formatDate(entry.project.createdAt);

    return (
        <Card className="transition-colors hover:ring-neutral-300 dark:hover:ring-neutral-700">
            <Link
                to={`/projects/${entry.project._id}`}
                className="flex items-start justify-between gap-4 rounded-lg p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                        {entry.project.name}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">
                        {entry.project.description || "No description"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                        <span>
                            {entry.project.members ?? 0}{" "}
                            {entry.project.members === 1 ? "member" : "members"}
                        </span>
                        {created && <span>Created {created}</span>}
                    </div>
                </div>

                {/*
                 * The caller's own role on this project, from the getProjects
                 * aggregation. The detail page re-derives it from the member
                 * list rather than trusting this copy, which goes stale as soon
                 * as an admin changes it.
                 */}
                <Badge tone={entry.role === "member" ? "neutral" : "accent"}>
                    {ROLE_LABELS[entry.role]}
                </Badge>
            </Link>
        </Card>
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
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-lg font-semibold tracking-tight">
                        Projects
                    </h1>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
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
                <div className="flex items-center gap-2 py-12 text-sm text-neutral-500 dark:text-neutral-400">
                    <Spinner />
                    Loading projects…
                </div>
            ) : error ? (
                <Alert>
                    {error instanceof ApiError
                        ? error.message
                        : "Could not load projects."}
                </Alert>
            ) : data && data.length > 0 ? (
                <div className="space-y-2">
                    {data.map((entry) => (
                        <ProjectRow key={entry.project._id} entry={entry} />
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
