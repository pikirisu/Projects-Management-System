import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, asApiError } from "../../lib/api";
import { keys } from "../../lib/queries";
import type { Project } from "../../lib/types";
import { Alert, Button, Dialog, Field, Textarea } from "../ui";

function NewProjectForm({ onDone }: { onDone: () => void }) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    const create = useMutation({
        mutationFn: () =>
            api.post<Project>("/projects", {
                name: name.trim(),
                description: description.trim() || undefined,
            }),
        onSuccess: (project) => {
            // The list entry carries a role and counts the create response
            // lacks, so refetch rather than splice it into the cache.
            void queryClient.invalidateQueries({ queryKey: keys.projects });
            toast.success(`Created ${project.name}`);
            onDone();
            void navigate(`/projects/${project._id}`);
        },
    });

    const error = asApiError(create.error);

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        create.mutate();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
            <Textarea
                label="Description"
                name="description"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                hint="Optional. What is this project for?"
            />
            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onDone}>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    loading={create.isPending}
                    disabled={!name.trim()}
                >
                    Create project
                </Button>
            </div>
        </form>
    );
}

export function NewProjectDialog({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) {
    return (
        <Dialog open={open} onClose={onClose} title="New project">
            {/* Mounted only while open, so every visit starts empty. */}
            <NewProjectForm onDone={onClose} />
        </Dialog>
    );
}
