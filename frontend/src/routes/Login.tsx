import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../context/auth";
import { asApiError } from "../lib/api";
import { AuthShell } from "../components/AuthShell";
import { Alert, Button, Field } from "../components/ui";

const linkClass =
    "font-medium text-indigo-600 hover:underline dark:text-indigo-400";

export function Login() {
    const { login, sessionExpired } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const signIn = useMutation({
        mutationFn: () => login(email, password),
        onSuccess: () => void navigate("/projects", { replace: true }),
    });
    const apiError = asApiError(signIn.error);
    const error = signIn.isError
        ? (apiError?.message ?? "Something went wrong. Try again.")
        : null;

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        signIn.mutate();
    }

    return (
        <AuthShell
            title="Sign in"
            subtitle="Pick up where your team left off."
            footer={
                <>
                    No account yet?{" "}
                    <Link to="/register" className={linkClass}>
                        Create one
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* The app signed them out, not they themselves: say why. */}
                {sessionExpired && !error && (
                    <Alert tone="info">
                        Your session ended. This happens when a password is
                        changed or a session is left for too long. Sign in to
                        pick up where you left off.
                    </Alert>
                )}

                {/*
                 * Only the top-level message: the API answers "Invalid
                 * credentials" for an unknown email and a wrong password alike,
                 * and pinning it to one field would reveal which it was.
                 */}
                {error && <Alert>{error}</Alert>}

                <Field
                    label="Email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    error={apiError?.fieldErrors.email}
                />

                <div>
                    <Field
                        label="Password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        error={apiError?.fieldErrors.password}
                    />
                    <Link
                        to="/forgot-password"
                        className="mt-1.5 inline-block text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                        Forgot your password?
                    </Link>
                </div>

                <Button
                    type="submit"
                    loading={signIn.isPending}
                    className="w-full"
                >
                    Sign in
                </Button>
            </form>
        </AuthShell>
    );
}
