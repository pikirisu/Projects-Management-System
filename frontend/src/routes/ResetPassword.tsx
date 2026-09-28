import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { AuthShell } from "../components/AuthShell";
import { Alert, Button, Field } from "../components/ui";

/*
 * This route exists because the reset email points at it: the API builds the
 * link from FORGOT_PASSWORD_REDIRECT_URL, which is a frontend URL ending in
 * /reset-password, plus the unhashed token. The token never leaves the URL --
 * it is posted straight back and is single-use, so there is nothing to store.
 */
export function ResetPassword() {
    const { token = "" } = useParams();
    const navigate = useNavigate();

    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");

    const mutation = useMutation({
        mutationFn: (newPassword: string) =>
            api.post(`/auth/reset-password/${token}`, { newPassword }),
    });

    const error = mutation.error instanceof ApiError ? mutation.error : null;

    // Checked here rather than server-side because the API takes a single
    // password field; the confirmation exists only to catch a typo that would
    // otherwise lock the user out again with a password they cannot reproduce.
    const mismatch =
        confirmation.length > 0 && password !== confirmation
            ? "Passwords do not match"
            : undefined;

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (mismatch) return;
        mutation.mutate(password);
    }

    if (mutation.isSuccess) {
        return (
            <AuthShell
                title="Password updated"
                subtitle="You can sign in with your new password now."
                footer={null}
            >
                <Button
                    className="w-full"
                    onClick={() => void navigate("/login", { replace: true })}
                >
                    Go to sign in
                </Button>
            </AuthShell>
        );
    }

    return (
        <AuthShell
            title="Choose a new password"
            subtitle="This link works once and expires 20 minutes after it was sent."
            footer={
                <>
                    Link expired?{" "}
                    <Link
                        to="/forgot-password"
                        className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                        Request another
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {error && <Alert>{error.message}</Alert>}

                <Field
                    label="New password"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    autoFocus
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    error={error?.fieldErrors.newPassword}
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
                    loading={mutation.isPending}
                    disabled={!password || !confirmation || Boolean(mismatch)}
                    className="w-full"
                >
                    Set new password
                </Button>
            </form>
        </AuthShell>
    );
}
