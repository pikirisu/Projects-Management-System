import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/auth";
import { displayName, formatDate, initials } from "../lib/display";
import type { User } from "../lib/types";
import { Alert, Avatar, Badge, Button, Card, Field } from "../components/ui";

function ProfileForm({ user }: { user: User }) {
    const { applyUser } = useAuth();
    const [fullName, setFullName] = useState(user.fullName ?? "");

    const mutation = useMutation({
        mutationFn: () =>
            api.patch<User>("/auth/profile", { fullName: fullName.trim() }),
        onSuccess: (updated) => {
            // The header, avatars and member lists all read the cached user.
            applyUser(updated);
        },
    });

    const error = mutation.error instanceof ApiError ? mutation.error : null;
    const dirty = fullName.trim() !== (user.fullName ?? "");

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        mutation.mutate();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && <Alert>{error.message}</Alert>}
            {mutation.isSuccess && !dirty && <Alert tone="info">Saved.</Alert>}

            <Field
                label="Display name"
                name="fullName"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                hint="Shown to your teammates. Your username and email cannot be changed."
                error={error?.fieldErrors.fullName}
            />

            <Button
                type="submit"
                size="sm"
                loading={mutation.isPending}
                disabled={!fullName.trim() || !dirty}
            >
                Save name
            </Button>
        </form>
    );
}

function ChangePasswordForm() {
    const { logout } = useAuth();
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");

    const mutation = useMutation({
        mutationFn: () =>
            api.post("/auth/change-password", { oldPassword, newPassword }),
    });

    const error = mutation.error instanceof ApiError ? mutation.error : null;

    const mismatch =
        confirmation.length > 0 && newPassword !== confirmation
            ? "Passwords do not match"
            : undefined;

    const sameAsOld =
        newPassword.length > 0 && newPassword === oldPassword
            ? "Choose a password different from the current one"
            : undefined;

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (mismatch || sameAsOld) return;
        mutation.mutate();
    }

    if (mutation.isSuccess) {
        return (
            <div className="space-y-4">
                {/*
                 * The server clears the stored refresh token on a password
                 * change, which ends every session including this one. Saying
                 * so is the point -- it is the reassurance someone changing a
                 * password after a scare is looking for.
                 */}
                <Alert tone="info">
                    Password updated. Every signed-in session was ended,
                    including this one, so anyone else holding your old
                    credentials has been signed out too.
                </Alert>
                <Button onClick={() => void logout()}>Sign in again</Button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && <Alert>{error.message}</Alert>}

            <Field
                label="Current password"
                name="oldPassword"
                type="password"
                autoComplete="current-password"
                required
                value={oldPassword}
                onChange={(event) => setOldPassword(event.target.value)}
                error={error?.fieldErrors.oldPassword}
            />

            <Field
                label="New password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                error={sameAsOld ?? error?.fieldErrors.newPassword}
            />

            <Field
                label="Confirm new password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                error={mismatch}
            />

            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Changing your password signs out every device, including this
                one.
            </p>

            <Button
                type="submit"
                size="sm"
                loading={mutation.isPending}
                disabled={
                    !oldPassword ||
                    !newPassword ||
                    !confirmation ||
                    Boolean(mismatch) ||
                    Boolean(sameAsOld)
                }
            >
                Change password
            </Button>
        </form>
    );
}

export function Account() {
    const { user } = useAuth();

    if (!user) return null;

    const joined = formatDate(user.createdAt);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-lg font-semibold tracking-tight">
                    Account
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Your profile and sign-in details.
                </p>
            </div>

            <Card className="p-4">
                <div className="flex items-center gap-3">
                    <Avatar
                        src={user.avatar?.url}
                        initials={initials(user)}
                        title={displayName(user)}
                    />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                            {displayName(user)}
                        </p>
                        <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                            @{user.username}
                            {joined && ` · joined ${joined}`}
                        </p>
                    </div>
                </div>

                <dl className="mt-4 grid gap-3 border-t border-neutral-200 pt-4 text-sm sm:grid-cols-2 dark:border-neutral-800">
                    <div>
                        <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                            Email
                        </dt>
                        <dd className="mt-0.5 truncate">{user.email}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                            Verification
                        </dt>
                        <dd className="mt-0.5">
                            {user.isEmailVerified === false ? (
                                <Badge>Not verified</Badge>
                            ) : user.isEmailVerified ? (
                                <Badge tone="accent">Verified</Badge>
                            ) : (
                                <span className="text-neutral-400">
                                    Unknown
                                </span>
                            )}
                        </dd>
                    </div>
                </dl>
            </Card>

            <Card className="p-4">
                <p className="mb-4 text-sm font-medium">Profile</p>
                <ProfileForm user={user} />
            </Card>

            <Card className="p-4">
                <p className="mb-4 text-sm font-medium">Change password</p>
                <ChangePasswordForm />
            </Card>
        </div>
    );
}
