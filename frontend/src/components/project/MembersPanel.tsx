import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { displayName, formatDate, initials } from "../../lib/display";
import {
    ROLE_LABELS,
    type ProjectMemberEntry,
    type Role,
} from "../../lib/types";
import { useAuth } from "../../context/auth";
import type { Permissions } from "../../routes/ProjectDetail";
import {
    Alert,
    Avatar,
    Button,
    Card,
    ConfirmButton,
    Field,
    Select,
    Spinner,
} from "../ui";

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as Role[]).map((value) => ({
    value,
    label: ROLE_LABELS[value],
}));

function AddMemberForm({
    projectId,
    onDone,
}: {
    projectId: string;
    onDone: () => void;
}) {
    const queryClient = useQueryClient();
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<Role>("member");

    const mutation = useMutation({
        mutationFn: () =>
            api.post(`/projects/${projectId}/members`, {
                email: email.trim(),
                role,
            }),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["project", projectId, "members"],
            });
            // The member count on the projects list is computed server-side.
            void queryClient.invalidateQueries({ queryKey: ["projects"] });
            onDone();
        },
    });

    const error = mutation.error instanceof ApiError ? mutation.error : null;

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        mutation.mutate();
    }

    return (
        <Card className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <p className="text-sm font-medium">Add member</p>

                {error && <Alert>{error.message}</Alert>}

                <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                        label="Email"
                        name="email"
                        type="email"
                        required
                        autoFocus
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        hint="They must already have an account."
                        error={error?.fieldErrors.email}
                    />
                    <Select
                        label="Role"
                        name="role"
                        value={role}
                        onChange={(event) =>
                            setRole(event.target.value as Role)
                        }
                        error={error?.fieldErrors.role}
                        options={ROLE_OPTIONS}
                    />
                </div>

                <div className="flex gap-2">
                    <Button
                        type="submit"
                        size="sm"
                        loading={mutation.isPending}
                        disabled={!email.trim()}
                    >
                        Add member
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

function MemberRow({
    entry,
    projectId,
    can,
    isSelf,
}: {
    entry: ProjectMemberEntry;
    projectId: string;
    can: Permissions;
    isSelf: boolean;
}) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const membersKey = ["project", projectId, "members"];

    function refresh() {
        void queryClient.invalidateQueries({ queryKey: membersKey });
        void queryClient.invalidateQueries({ queryKey: ["projects"] });
    }

    const changeRole = useMutation({
        mutationFn: (newRole: Role) =>
            api.put(`/projects/${projectId}/members/${entry.user._id}`, {
                newRole,
            }),
        onSuccess: refresh,
    });

    const remove = useMutation({
        mutationFn: () =>
            api.delete(`/projects/${projectId}/members/${entry.user._id}`),
        onSuccess: () => {
            refresh();
            // Leaving a project revokes your own access to it, so staying on
            // the page would just render a wall of permission errors.
            if (isSelf) void navigate("/projects", { replace: true });
        },
    });

    const joined = formatDate(entry.createdAt);
    const failure = changeRole.error ?? remove.error;

    return (
        <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                        src={entry.user.avatar?.url}
                        initials={initials(entry.user)}
                        title={displayName(entry.user)}
                    />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                            {displayName(entry.user)}
                            {isSelf && (
                                <span className="ml-1.5 text-xs font-normal text-neutral-400">
                                    you
                                </span>
                            )}
                        </p>
                        <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                            @{entry.user.username}
                            {joined && ` · joined ${joined}`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/*
                     * Admins may step down or leave, including from their own
                     * row. What stops a project from ending up unmanageable is
                     * the server: updateMemberRole and deleteMember both refuse
                     * with a 409 when the change would remove its last admin,
                     * which surfaces in the alert below.
                     */}
                    {can.manageProject ? (
                        <>
                            <Select
                                aria-label={`Role for ${displayName(entry.user)}`}
                                value={entry.role}
                                disabled={changeRole.isPending}
                                onChange={(event) =>
                                    changeRole.mutate(
                                        event.target.value as Role,
                                    )
                                }
                                className="!py-1 text-xs"
                                options={ROLE_OPTIONS}
                            />
                            <ConfirmButton
                                loading={remove.isPending}
                                onConfirm={() => remove.mutate()}
                                confirmLabel={isSelf ? "Leave" : "Remove"}
                            >
                                {isSelf ? "Leave project" : "Remove"}
                            </ConfirmButton>
                        </>
                    ) : (
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            {ROLE_LABELS[entry.role]}
                        </span>
                    )}
                </div>
            </div>

            {failure instanceof ApiError && (
                <div className="mt-3">
                    <Alert>{failure.message}</Alert>
                </div>
            )}
        </Card>
    );
}

export function MembersPanel({
    projectId,
    can,
    members,
    isPending,
    error,
}: {
    projectId: string;
    can: Permissions;
    members?: ProjectMemberEntry[];
    isPending: boolean;
    error: unknown;
}) {
    const { user } = useAuth();
    const [adding, setAdding] = useState(false);

    if (isPending) {
        return (
            <div className="flex items-center gap-2 py-12 text-sm text-neutral-500 dark:text-neutral-400">
                <Spinner />
                Loading members…
            </div>
        );
    }

    if (error) {
        return (
            <Alert>
                {error instanceof ApiError
                    ? error.message
                    : "Could not load members."}
            </Alert>
        );
    }

    const all = members ?? [];

    return (
        <div className="space-y-4">
            {can.manageProject && !adding && (
                <div className="flex justify-end">
                    <Button size="sm" onClick={() => setAdding(true)}>
                        Add member
                    </Button>
                </div>
            )}

            {adding && (
                <AddMemberForm
                    projectId={projectId}
                    onDone={() => setAdding(false)}
                />
            )}

            <div className="space-y-2">
                {all.map((entry) => (
                    <MemberRow
                        key={entry.user._id}
                        entry={entry}
                        projectId={projectId}
                        can={can}
                        isSelf={entry.user._id === user?._id}
                    />
                ))}
            </div>
        </div>
    );
}
