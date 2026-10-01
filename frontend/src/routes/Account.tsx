import {
    useEffect,
    useRef,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "../context/auth";
import { api, asApiError } from "../lib/api";
import {
    AVATAR_ACCEPT,
    AVATAR_MAX_BYTES,
    PASSWORD_MIN_LENGTH,
} from "../lib/constants";
import { displayName, formatDate, initials } from "../lib/display";
import type { User } from "../lib/types";
import { ThemeToggle } from "../components/ThemeToggle";
import {
    Alert,
    Avatar,
    Badge,
    Button,
    Card,
    Field,
    FileInput,
    PageHeader,
} from "../components/ui";

/** A titled block of the settings page: what it is on the left, the form on the right. */
function Section({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <section className="grid gap-4 border-t border-hairline pt-8 md:grid-cols-[15rem_1fr] md:gap-10">
            <div>
                <h2 className="text-heading text-strong">{title}</h2>
                <p className="mt-1 text-sm text-muted">{description}</p>
            </div>
            <Card className="p-5">{children}</Card>
        </section>
    );
}

function AvatarForm({ user }: { user: User }) {
    const { applyUser } = useAuth();
    const inputRef = useRef<HTMLInputElement>(null);
    const previewRef = useRef<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    // The preview is a blob URL the browser holds until it is revoked.
    // createObjectURL is guarded because jsdom does not implement it.
    function choose(chosen: File | null) {
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        let next: string | null = null;
        try {
            next = chosen ? URL.createObjectURL(chosen) : null;
        } catch {
            next = null;
        }
        previewRef.current = next;
        setPreview(next);
        setFile(chosen);
    }

    useEffect(
        () => () => {
            if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        },
        [],
    );

    const tooBig = file !== null && file.size > AVATAR_MAX_BYTES;

    const upload = useMutation({
        mutationFn: () => {
            const form = new FormData();
            form.append("avatar", file as File);
            return api.patch<User>("/auth/avatar", form);
        },
        onSuccess: (updated) => {
            applyUser(updated);
            choose(null);
            // Otherwise choosing the same file again would fire no change.
            if (inputRef.current) inputRef.current.value = "";
            toast.success("Photo updated");
        },
    });
    const error = asApiError(upload.error);

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (file && !tooBig) upload.mutate();
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
            {/* Checked here too, so an oversized file costs nobody an upload. */}
            {tooBig && (
                <Alert>That image is over 500 KB. Choose a smaller one.</Alert>
            )}
            <Button
                type="submit"
                size="sm"
                loading={upload.isPending}
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

    const save = useMutation({
        mutationFn: () =>
            api.patch<User>("/auth/profile", { fullName: fullName.trim() }),
        onSuccess: (updated) => {
            // The sidebar, avatars and member lists all read the cached user.
            applyUser(updated);
            toast.success("Name saved");
        },
    });
    const error = asApiError(save.error);
    const dirty = fullName.trim() !== (user.fullName ?? "");

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        save.mutate();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && <Alert>{error.message}</Alert>}
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
                loading={save.isPending}
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

    const change = useMutation({
        mutationFn: () =>
            api.post("/auth/change-password", { oldPassword, newPassword }),
    });
    const error = asApiError(change.error);

    const problem =
        newPassword.length > 0 && newPassword.length < PASSWORD_MIN_LENGTH
            ? `Use at least ${PASSWORD_MIN_LENGTH} characters`
            : newPassword.length > 0 && newPassword === oldPassword
              ? "Choose a password different from the current one"
              : undefined;
    const mismatch =
        confirmation.length > 0 && newPassword !== confirmation
            ? "Passwords do not match"
            : undefined;

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!problem && !mismatch) change.mutate();
    }

    if (change.isSuccess) {
        return (
            <div className="space-y-4">
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
                hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
                error={problem ?? error?.fieldErrors.newPassword}
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
            <Button
                type="submit"
                size="sm"
                loading={change.isPending}
                disabled={
                    !oldPassword ||
                    !newPassword ||
                    !confirmation ||
                    Boolean(problem) ||
                    Boolean(mismatch)
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
        <div className="space-y-8">
            <PageHeader
                title="Account"
                description="Your profile, sign-in details and preferences."
            />

            <Card className="flex flex-wrap items-center gap-4 p-5">
                <Avatar
                    src={user.avatar?.url}
                    initials={initials(user)}
                    title={displayName(user)}
                    size="lg"
                />
                <div className="min-w-0 flex-1">
                    <p className="text-title truncate text-strong">
                        {displayName(user)}
                    </p>
                    <p className="truncate text-sm text-muted">
                        @{user.username}
                        {joined && ` · joined ${joined}`}
                    </p>
                </div>
                <dl className="flex flex-wrap gap-6 text-sm">
                    <div>
                        <dt className="text-xs text-faint">Email</dt>
                        <dd className="mt-0.5 text-strong">{user.email}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-faint">Verification</dt>
                        <dd className="mt-0.5">
                            {user.isEmailVerified === false ? (
                                <Badge tone="warning">Not verified</Badge>
                            ) : user.isEmailVerified ? (
                                <Badge tone="success">Verified</Badge>
                            ) : (
                                <span className="text-faint">Unknown</span>
                            )}
                        </dd>
                    </div>
                </dl>
            </Card>

            <Section
                title="Profile"
                description="How you appear to the people you work with."
            >
                <div className="space-y-6">
                    <AvatarForm user={user} />
                    <div className="border-t border-hairline pt-6">
                        <ProfileForm user={user} />
                    </div>
                </div>
            </Section>

            <Section
                title="Password"
                description="Changing it signs out every device, including this one."
            >
                <ChangePasswordForm />
            </Section>

            <Section
                title="Appearance"
                description="Light, dark, or whatever your system uses."
            >
                <ThemeToggle className="w-full max-w-xs" />
            </Section>
        </div>
    );
}
