import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api, asApiError } from "../lib/api";
import { PASSWORD_MIN_LENGTH } from "../lib/constants";
import { AuthShell } from "../components/AuthShell";
import { Alert, Button, PasswordField } from "../components/ui";

/** The page the reset email links to: FORGOT_PASSWORD_REDIRECT_URL/:token. */
export function ResetPassword() {
    const { token = "" } = useParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");

    const reset = useMutation({
        mutationFn: (newPassword: string) =>
            api.post(`/auth/reset-password/${token}`, { newPassword }),
    });
    const error = asApiError(reset.error);

    const tooShort =
        password.length > 0 && password.length < PASSWORD_MIN_LENGTH
            ? `Use at least ${PASSWORD_MIN_LENGTH} characters`
            : undefined;
    // The API takes one password; the confirmation only catches a typo.
    const mismatch =
        confirmation.length > 0 && password !== confirmation
            ? "Passwords do not match"
            : undefined;

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!tooShort && !mismatch) reset.mutate(password);
    }

    if (reset.isSuccess) {
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
                <PasswordField
                    label="New password"
                    name="newPassword"
                    autoComplete="new-password"
                    required
                    autoFocus
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
                    error={tooShort ?? error?.fieldErrors.newPassword}
                />
                <PasswordField
                    label="Confirm new password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    required
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    error={mismatch}
                />
                <Button
                    type="submit"
                    loading={reset.isPending}
                    disabled={
                        !password ||
                        !confirmation ||
                        Boolean(tooShort) ||
                        Boolean(mismatch)
                    }
                    className="w-full"
                >
                    Set new password
                </Button>
            </form>
        </AuthShell>
    );
}
