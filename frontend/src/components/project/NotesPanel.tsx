import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { asUser, displayName, formatDate, initials } from "../../lib/display";
import type { Note } from "../../lib/types";
import type { Permissions } from "../../routes/ProjectDetail";
import {
    Alert,
    Avatar,
    Button,
    Card,
    ConfirmButton,
    EmptyState,
    Spinner,
    Textarea,
} from "../ui";

function NoteComposer({
    projectId,
    note,
    onDone,
}: {
    projectId: string;
    /** Present when editing an existing note, absent when writing a new one. */
    note?: Note;
    onDone: () => void;
}) {
    const queryClient = useQueryClient();
    const [content, setContent] = useState(note?.content ?? "");

    const mutation = useMutation({
        mutationFn: () =>
            note
                ? api.put<Note>(`/notes/${projectId}/n/${note._id}`, {
                      content: content.trim(),
                  })
                : api.post<Note>(`/notes/${projectId}`, {
                      content: content.trim(),
                  }),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["project", projectId, "notes"],
            });
            onDone();
        },
    });

    const error = mutation.error instanceof ApiError ? mutation.error : null;

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        mutation.mutate();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            {error && <Alert>{error.message}</Alert>}

            <Textarea
                label={note ? "Edit note" : "New note"}
                name="content"
                rows={4}
                required
                autoFocus
                value={content}
                onChange={(event) => setContent(event.target.value)}
                error={error?.fieldErrors.content}
            />

            <div className="flex gap-2">
                <Button
                    type="submit"
                    size="sm"
                    loading={mutation.isPending}
                    disabled={!content.trim()}
                >
                    {note ? "Save note" : "Add note"}
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
    );
}

function NoteCard({
    note,
    projectId,
    can,
}: {
    note: Note;
    projectId: string;
    can: Permissions;
}) {
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(false);

    const remove = useMutation({
        mutationFn: () => api.delete<Note>(`/notes/${projectId}/n/${note._id}`),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["project", projectId, "notes"],
            });
        },
    });

    const author = asUser(note.createdBy);
    const written = formatDate(note.updatedAt ?? note.createdAt);

    if (editing) {
        return (
            <Card className="p-4">
                <NoteComposer
                    projectId={projectId}
                    note={note}
                    onDone={() => setEditing(false)}
                />
            </Card>
        );
    }

    return (
        <Card className="space-y-3 p-4">
            <p className="text-sm whitespace-pre-wrap">{note.content}</p>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-muted">
                    <Avatar
                        size="sm"
                        src={author?.avatar?.url}
                        initials={initials(author)}
                        title={displayName(author)}
                    />
                    {author ? displayName(author) : "Unknown author"}
                    {written && <span>· {written}</span>}
                </div>

                {/*
                 * Notes are admin-only on the server (note.routes.js gates
                 * create, update and delete on UserRolesEnum.ADMIN alone), so
                 * project admins see them read-only -- same as members.
                 */}
                {can.manageProject && (
                    <div className="flex items-center gap-1">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(true)}
                        >
                            Edit
                        </Button>
                        <ConfirmButton
                            loading={remove.isPending}
                            onConfirm={() => remove.mutate()}
                            describedAs={`Delete note: ${note.content.slice(0, 40)}`}
                        />
                    </div>
                )}
            </div>

            {remove.error instanceof ApiError && (
                <Alert>{remove.error.message}</Alert>
            )}
        </Card>
    );
}

export function NotesPanel({
    projectId,
    can,
    notes,
    isPending,
    error,
}: {
    projectId: string;
    can: Permissions;
    notes?: Note[];
    isPending: boolean;
    error: unknown;
}) {
    const [composing, setComposing] = useState(false);

    if (isPending) {
        return (
            <div className="flex items-center gap-2 py-12 text-sm text-muted">
                <Spinner />
                Loading notes…
            </div>
        );
    }

    if (error) {
        return (
            <Alert>
                {error instanceof ApiError
                    ? error.message
                    : "Could not load notes."}
            </Alert>
        );
    }

    const all = notes ?? [];

    return (
        <div className="space-y-4">
            {can.manageProject && !composing && (
                <div className="flex justify-end">
                    <Button size="sm" onClick={() => setComposing(true)}>
                        New note
                    </Button>
                </div>
            )}

            {composing && (
                <Card className="p-4">
                    <NoteComposer
                        projectId={projectId}
                        onDone={() => setComposing(false)}
                    />
                </Card>
            )}

            {all.length === 0 ? (
                <EmptyState
                    title="No notes yet"
                    description={
                        can.manageProject
                            ? "Notes are for context the whole project needs — decisions, links, conventions."
                            : "Project admins have not written any notes yet."
                    }
                    action={
                        can.manageProject && !composing ? (
                            <Button
                                size="sm"
                                onClick={() => setComposing(true)}
                            >
                                New note
                            </Button>
                        ) : undefined
                    }
                />
            ) : (
                <div className="space-y-3">
                    {all.map((note) => (
                        <NoteCard
                            key={note._id}
                            note={note}
                            projectId={projectId}
                            can={can}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
