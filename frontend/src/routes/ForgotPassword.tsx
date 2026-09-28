import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { AuthShell } from "../components/AuthShell";
import { Alert, Button, Field } from "../components/ui";

export function ForgotPassword() {
    const [email, setEmail] = useState("");

    const mutation = useMutation({
        mutationFn: (address: string) =>
            api.post("/auth/forgot-password", { email: address }),
    });

    const error = mutation.error instanceof ApiError ? mutation.error : null;

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        mutation.mutate(email.trim());
    }

    return (
        <AuthShell
            title="Reset your password"
            subtitle="We will email you a link to choose a new one."
            footer={
                <>
                    Remembered it?{" "}
                    <Link
                        to="/login"
                        className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                        Back to sign in
                    </Link>
                </>
            }
        >
            {mutation.isSuccess ? (
                /*
                 * The same wording whether or not the address is registered.
                 * The API answers 200 either way on purpose -- saying "no such
                 * account" here would turn this form into a way to test which
                 * email addresses have signed up.
                 */
                <Alert tone="info">
                    If an account exists for {email.trim()}, a reset link is on
                    its way. The link expires in 20 minutes.
                </Alert>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    {error && <Alert>{error.message}</Alert>}

                    <Field
                        label="Email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        autoFocus
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        error={error?.fieldErrors.email}
                    />

                    <Button
                        type="submit"
                        loading={mutation.isPending}
                        disabled={!email.trim()}
                        className="w-full"
                    >
                        Send reset link
                    </Button>
                </form>
            )}
        </AuthShell>
    );
}
