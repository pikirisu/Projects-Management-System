import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/auth";
import { displayName, formatDate, initials } from "../lib/display";
import type { User } from "../lib/types";
import {
    Alert,
    Avatar,
    Badge,
    Button,
    Card,
    Field,
    FileInput,
} from "../components/ui";

/** Matches the server's allowlist, so the file picker offers only what it takes. */
const AVATAR_ACCEPT = "image/jpeg,image/png,image/gif,image/webp";
const AVATAR_MAX_BYTES = 512 * 1000;

function AvatarForm({ user }: { user: User }) {
    const { applyUser } = useAuth();
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [tooBig, setTooBig] = useState(false);

    /*
     * The preview is a blob URL, which the browser holds onto until it is
     * revoked. It is derived in the change handler rather than an effect: the
     * file being chosen is the event that produces it, and deriving it in an
     * effect would set state during a render pass for no reason.
     *
     * The ref is how the previous URL is found in order to revoke it, since the
     * state value is not readable from inside the next handler's closure.
     * createObjectURL is guarded because jsdom does not implement it, and a
     * missing preview is not worth failing a render over.
     */
    const previewRef = useRef<string | null>(null);

    function choose(chosen: File | null) {
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);

        let next: string | null = null;
        if (chosen) {
            try {
                next = URL.createObjectURL(chosen);
            } catch {
                next = null;
            }
        }

        previewRef.current = next;
        setPreview(next);
        setFile(chosen);
        // Checked here as well as on the server, so the answer is instant and
        // costs nobody an upload.
        // `chosen !== null` rather than Boolean(chosen): the latter does not
        // narrow the type, so the size read below would not compile.
        setTooBig(chosen !== null && chosen.size > AVATAR_MAX_BYTES);
    }

    // Synchronising with something outside React -- the browser's table of live
    // blob URLs -- which is what an effect is actually for.
    useEffect(
        () => () => {
            if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        },
        [],
    );

    const mutation = useMutation({
        mutationFn: () => {
            const form = new FormData();
            // The field name the route's multer instance listens on.
            form.append("avatar", file as File);
            return api.patch<User>("/auth/avatar", form);
        },
        onSuccess: (updated) => {
            applyUser(updated);
            choose(null);
            // Without this the same file cannot be chosen twice in a row: the
            // input keeps its value, so re-picking it fires no change event.
            if (inputRef.current) inputRef.current.value = "";
        },
    });

    const error = mutation.error instanceof ApiError ? mutation.error : null;

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!file || tooBig) return;
        mutation.mutate();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && <Alert>{error.message}</Alert>}

            <div className="flex items-center gap-4">
                <Avatar
                    src={preview ?? user.avatar?.url}
                    initials={initials(user)}
                    title={displayName(user)}
                    size="lg"
                />
                <div className="min-w-0 flex-1">
                    <FileInput
                        label="Profile photo"
                        inputRef={inputRef}
                        id="avatar"
                        name="avatar"
                        accept={AVATAR_ACCEPT}
                        onChange={(event) =>
                            choose(event.target.files?.[0] ?? null)
                        }
                        hint="JPEG, PNG, GIF or WebP, up to 500 KB."
                    />
                </div>
            </div>

            {tooBig && (
                <Alert>That image is over 500 KB. Choose a smaller one.</Alert>
            )}

            <Button
                type="submit"
                size="sm"
                loading={mutation.isPending}
                disabled={!file || tooBig}
            >
                Save photo
            </Button>
        </form>
    );
}

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

            <p className="text-xs text-muted">
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
                <h1 className="text-display text-strong">Account</h1>
                <p className="text-sm text-muted">
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
                        <p className="truncate text-xs text-muted">
                            @{user.username}
                            {joined && ` · joined ${joined}`}
                        </p>
                    </div>
                </div>

                <dl className="mt-4 grid gap-3 border-t border-hairline pt-4 text-sm sm:grid-cols-2">
                    <div>
                        <dt className="text-xs text-muted">Email</dt>
                        <dd className="mt-0.5 truncate">{user.email}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted">Verification</dt>
                        <dd className="mt-0.5">
                            {user.isEmailVerified === false ? (
                                <Badge>Not verified</Badge>
                            ) : user.isEmailVerified ? (
                                <Badge tone="accent">Verified</Badge>
                            ) : (
                                <span className="text-faint">Unknown</span>
                            )}
                        </dd>
                    </div>
                </dl>
            </Card>

            <Card className="p-4">
                <p className="mb-4 text-sm font-medium">Profile</p>
                <div className="space-y-6">
                    <AvatarForm user={user} />
                    <div className="border-t border-hairline pt-6">
                        <ProfileForm user={user} />
                    </div>
                </div>
            </Card>

            <Card className="p-4">
                <p className="mb-4 text-sm font-medium">Change password</p>
                <ChangePasswordForm />
            </Card>
        </div>
    );
}
