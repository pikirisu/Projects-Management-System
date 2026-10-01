import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "../../context/auth";
import { useProjectContext } from "../../context/project";
import { api, asApiError, errorMessage } from "../../lib/api";
import { displayName, formatDate } from "../../lib/display";
import { invalidateMembers, invalidateTasks } from "../../lib/queries";
import {
    ROLE_LABELS,
    type ProjectMemberEntry,
    type Role,
} from "../../lib/types";
import {
    Alert,
    Badge,
    Button,
    Card,
    ConfirmButton,
    Field,
    Select,
    Skeleton,
    UserAvatar,
} from "../ui";

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as Role[]).map((value) => ({
    value,
    label: ROLE_LABELS[value],
}));

function AddMemberForm({ onDone }: { onDone: () => void }) {
    const { projectId } = useProjectContext();
    const queryClient = useQueryClient();
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<Role>("member");

    const add = useMutation({
        mutationFn: () =>
            api.post(`/projects/${projectId}/members`, {
                email: email.trim(),
                role,
            }),
        onSuccess: () => {
            invalidateMembers(queryClient, projectId);
            toast.success("Member added");
            onDone();
        },
    });

    const error = asApiError(add.error);

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        add.mutate();
    }

    return (
        <Card className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <p className="text-heading text-strong">Add member</p>
                {error && <Alert>{error.message}</Alert>}

                <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
                    <Field
                        label="Email"
                        name="email"
                        type="email"
                        required
                        autoFocus
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        hint="They need an account already."
                        error={error?.fieldErrors.email}
                    />
                    <Select
                        label="Role"
                        name="role"
                        value={role}
                        onChange={(event) =>
                            setRole(event.target.value as Role)
                        }
                        options={ROLE_OPTIONS}
                    />
                </div>

                <div className="flex gap-2">
                    <Button
                        type="submit"
                        size="sm"
                        loading={add.isPending}
                        disabled={!email.trim()}
                    >
                        Add member
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onDone}>
                        Cancel
                    </Button>
                </div>
            </form>
        </Card>
    );
}

function MemberRow({
    entry,
    isSelf,
}: {
    entry: ProjectMemberEntry;
    isSelf: boolean;
}) {
    const { projectId, can } = useProjectContext();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const name = displayName(entry.user);
    const path = `/projects/${projectId}/members/${entry.user._id}`;

    const changeRole = useMutation({
        mutationFn: (newRole: Role) => api.put(path, { newRole }),
        onSuccess: () => {
            invalidateMembers(queryClient, projectId);
            toast.success(`Updated ${name}'s role`);
        },
    });

    const remove = useMutation({
        mutationFn: () => api.delete(path),
        onSuccess: () => {
            invalidateMembers(queryClient, projectId);
            // Their tasks in this project were unassigned server-side.
            invalidateTasks(queryClient, projectId);
            toast.success(isSelf ? "You left the project" : `Removed ${name}`);
            // Leaving revokes your own access, so there is nothing left here.
            if (isSelf) void navigate("/projects", { replace: true });
        },
    });

    const joined = formatDate(entry.createdAt);
    const failure = changeRole.error ?? remove.error;

    return (
        <li className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar user={entry.user} />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-strong">
                            {name}
                            {isSelf && (
                                <span className="ml-1.5 text-xs font-normal text-faint">
                                    you
                                </span>
                            )}
                        </p>
                        <p className="truncate text-xs text-muted">
                            @{entry.user.username}
                            {joined && ` · joined ${joined}`}
                        </p>
                    </div>
                </div>

                {/*
                 * An admin may change their own role or leave. The server
                 * refuses (409) whatever would leave the project without an
                 * admin, and the alert below says so.
                 */}
                {can.manageProject ? (
                    <div className="flex items-center gap-2">
                        <Select
                            aria-label={`Role for ${name}`}
                            value={entry.role}
                            disabled={changeRole.isPending}
                            onChange={(event) =>
                                changeRole.mutate(event.target.value as Role)
                            }
                            className="!py-1 text-xs"
                            options={ROLE_OPTIONS}
                        />
                        <ConfirmButton
                            loading={remove.isPending}
                            onConfirm={() => remove.mutate()}
                            confirmLabel={isSelf ? "Leave" : "Remove"}
                            describedAs={isSelf ? undefined : `Remove ${name}`}
                        >
                            {isSelf ? "Leave project" : "Remove"}
                        </ConfirmButton>
                    </div>
                ) : (
                    <Badge
                        tone={entry.role === "member" ? "neutral" : "accent"}
                    >
                        {ROLE_LABELS[entry.role]}
                    </Badge>
                )}
            </div>

            {failure && (
                <div className="mt-3">
                    <Alert>
                        {errorMessage(failure, "That change failed.")}
                    </Alert>
                </div>
            )}
        </li>
    );
}

export function MembersPanel({
    isPending,
    error,
}: {
    isPending: boolean;
    error: unknown;
}) {
    const { user } = useAuth();
    const { members, can } = useProjectContext();
    const [adding, setAdding] = useState(false);

    if (isPending) {
        return (
            <Card className="divide-y divide-hairline">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <Skeleton className="size-8 rounded-full" />
                        <Skeleton className="h-4 w-40" />
                    </div>
                ))}
            </Card>
        );
    }
    if (error) {
        return <Alert>{errorMessage(error, "Could not load members.")}</Alert>;
    }

    return (
        <div className="space-y-4">
            {can.manageProject && !adding && (
                <div className="flex justify-end">
                    <Button size="sm" onClick={() => setAdding(true)}>
                        Add member
                    </Button>
                </div>
            )}

            {adding && <AddMemberForm onDone={() => setAdding(false)} />}

            <Card>
                <ul className="divide-y divide-hairline">
                    {members.map((entry) => (
                        <MemberRow
                            key={entry.user._id}
                            entry={entry}
                            isSelf={entry.user._id === user?._id}
                        />
                    ))}
                </ul>
            </Card>
        </div>
    );
}
