import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, asApiError, errorMessage } from "../../lib/api";
import { keys } from "../../lib/queries";
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
            queryClient.setQueryData(keys.project(project._id), updated);
            void queryClient.invalidateQueries({ queryKey: keys.projects });
            toast.success("Project saved");
        },
    });

    const remove = useMutation({
        mutationFn: () => api.delete(`/projects/${project._id}`),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: keys.projects });
            void queryClient.invalidateQueries({ queryKey: keys.myTasks });
            toast.success(`Deleted ${project.name}`);
            void navigate("/projects", { replace: true });
        },
    });

    const saveError = asApiError(save.error);
    const dirty =
        name.trim() !== project.name ||
        description.trim() !== (project.description ?? "");

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        save.mutate();
    }

    return (
        <div className="max-w-2xl space-y-6">
            <Card className="p-5">
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    <p className="text-heading text-strong">Project details</p>
                    {saveError && <Alert>{saveError.message}</Alert>}
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

            <Card className="border-red-200 p-5 dark:border-red-900/60">
                <p className="text-heading text-red-700 dark:text-red-400">
                    Delete this project
                </p>
                <p className="mt-1 text-sm text-muted">
                    Its tasks, subtasks, notes, members and uploaded files go
                    with it. This cannot be undone.
                </p>
                {remove.isError && (
                    <div className="mt-3">
                        <Alert>
                            {errorMessage(remove.error, "Could not delete it.")}
                        </Alert>
                    </div>
                )}
                <div className="mt-4">
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
