import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import type { Project } from "../../lib/types";
import { Alert, Button, Card, ConfirmButton, Field, Textarea } from "../ui";

export function ProjectSettings({ project }: { project: Project }) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [name, setName] = useState(project.name);
    const [description, setDescription] = useState(project.description ?? "");

    const save = useMutation({
        mutationFn: () =>
            api.put<Project>(`/projects/${project._id}`, {
                name: name.trim(),
                description: description.trim(),
            }),
        onSuccess: (updated) => {
            queryClient.setQueryData(["project", project._id], updated);
            void queryClient.invalidateQueries({ queryKey: ["projects"] });
        },
    });

    const remove = useMutation({
        mutationFn: () => api.delete(`/projects/${project._id}`),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["projects"] });
            // Nothing left to render here once the project is gone.
            void navigate("/projects", { replace: true });
        },
    });

    const saveError = save.error instanceof ApiError ? save.error : null;
    const dirty =
        name.trim() !== project.name ||
        description.trim() !== (project.description ?? "");

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        save.mutate();
    }

    return (
        <div className="space-y-6">
            <Card className="p-4">
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    <p className="text-sm font-medium">Project details</p>

                    {saveError && <Alert>{saveError.message}</Alert>}
                    {save.isSuccess && !dirty && (
                        <Alert tone="info">Saved.</Alert>
                    )}

                    <Field
                        label="Name"
                        name="name"
                        required
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        error={saveError?.fieldErrors.name}
                    />

                    <Textarea
                        label="Description"
                        name="description"
                        rows={3}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        error={saveError?.fieldErrors.description}
                    />

                    <Button
                        type="submit"
                        size="sm"
                        loading={save.isPending}
                        disabled={!name.trim() || !dirty}
                    >
                        Save changes
                    </Button>
                </form>
            </Card>

            <Card className="p-4">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    Danger zone
                </p>
                <p className="mt-1 text-sm text-muted">
                    Deleting this project also removes its tasks, subtasks,
                    notes, members and uploaded files. This cannot be undone.
                </p>

                {remove.error instanceof ApiError && (
                    <div className="mt-3">
                        <Alert>{remove.error.message}</Alert>
                    </div>
                )}

                <div className="mt-3">
                    <ConfirmButton
                        size="md"
                        loading={remove.isPending}
                        onConfirm={() => remove.mutate()}
                        confirmLabel="Delete permanently"
                    >
                        Delete project
                    </ConfirmButton>
                </div>
            </Card>
        </div>
    );
}
