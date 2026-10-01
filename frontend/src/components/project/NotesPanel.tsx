import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { StickyNote } from "lucide-react";
import { toast } from "sonner";
import { useProjectContext } from "../../context/project";
import { api, asApiError, errorMessage } from "../../lib/api";
import { asUser, displayName, formatDate } from "../../lib/display";
import { keys } from "../../lib/queries";
import type { Note } from "../../lib/types";
import {
    Alert,
    Button,
    Card,
    ConfirmButton,
    EmptyState,
    Skeleton,
    Textarea,
    UserAvatar,
} from "../ui";

/** Writes a new note, or edits `note` when one is given. */
function NoteComposer({ note, onDone }: { note?: Note; onDone: () => void }) {
    const { projectId } = useProjectContext();
    const queryClient = useQueryClient();
    const [content, setContent] = useState(note?.content ?? "");

    const save = useMutation({
        mutationFn: () => {
            const body = { content: content.trim() };
            return note
                ? api.put<Note>(`/notes/${projectId}/n/${note._id}`, body)
                : api.post<Note>(`/notes/${projectId}`, body);
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: keys.notes(projectId),
            });
            toast.success(note ? "Note saved" : "Note added");
            onDone();
        },
    });

    const error = asApiError(save.error);

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        save.mutate();
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
                    loading={save.isPending}
                    disabled={!content.trim()}
                >
                    {note ? "Save note" : "Add note"}
                </Button>
                <Button size="sm" variant="ghost" onClick={onDone}>
                    Cancel
                </Button>
            </div>
        </form>
    );
}

function NoteCard({ note }: { note: Note }) {
    const { projectId, can } = useProjectContext();
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(false);
    const author = asUser(note.createdBy);
    const written = formatDate(note.updatedAt ?? note.createdAt);

    const remove = useMutation({
        mutationFn: () => api.delete(`/notes/${projectId}/n/${note._id}`),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: keys.notes(projectId),
            });
            toast.success("Note deleted");
        },
        onError: (error) =>
            toast.error(errorMessage(error, "Could not delete the note")),
    });

    if (editing) {
        return (
            <Card className="p-4">
                <NoteComposer note={note} onDone={() => setEditing(false)} />
            </Card>
        );
    }

    return (
        <Card className="space-y-3 p-4">
            <p className="text-sm whitespace-pre-wrap text-strong">
                {note.content}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-muted">
                    <UserAvatar user={author} size="sm" />
                    {author ? displayName(author) : "Unknown author"}
                    {written && <span>· {written}</span>}
                </div>
                {/* Notes are admin-only on the server, even for project admins. */}
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
        </Card>
    );
}

export function NotesPanel({
    notes,
    isPending,
    error,
}: {
    notes?: Note[];
    isPending: boolean;
    error: unknown;
}) {
    const { can } = useProjectContext();
    const [composing, setComposing] = useState(false);

    if (isPending) {
        return (
            <div className="space-y-3">
                {[0, 1].map((i) => (
                    <Card key={i} className="space-y-2 p-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-1/2" />
                    </Card>
                ))}
            </div>
        );
    }
    if (error) {
        return <Alert>{errorMessage(error, "Could not load notes.")}</Alert>;
    }

    const all = notes ?? [];
    const newNoteButton = can.manageProject && !composing && (
        <Button size="sm" onClick={() => setComposing(true)}>
            New note
        </Button>
    );

    return (
        <div className="space-y-4">
            {all.length > 0 && newNoteButton && (
                <div className="flex justify-end">{newNoteButton}</div>
            )}

            {composing && (
                <Card className="p-4">
                    <NoteComposer onDone={() => setComposing(false)} />
                </Card>
            )}

            {all.length === 0 ? (
                <EmptyState
                    icon={<StickyNote className="size-5" />}
                    title="No notes yet"
                    description={
                        can.manageProject
                            ? "Notes hold context the whole project needs: decisions, links, conventions."
                            : "The project's admins have not written any notes yet."
                    }
                    action={newNoteButton}
                />
            ) : (
                <div className="space-y-3">
                    {all.map((note) => (
                        <NoteCard key={note._id} note={note} />
                    ))}
                </div>
            )}
        </div>
    );
}
