import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../context/auth";
import { asApiError } from "../lib/api";
import { AuthShell } from "../components/AuthShell";
import { Alert, Button, Field, PasswordField } from "../components/ui";

const linkClass =
    "font-medium text-indigo-600 hover:underline dark:text-indigo-400";

interface Credentials {
    email: string;
    password: string;
}

/** The public demo account, when this build was given one. */
function demoCredentials(): Credentials | null {
    const email = import.meta.env.VITE_DEMO_EMAIL;
    const password = import.meta.env.VITE_DEMO_PASSWORD;
    return email && password ? { email, password } : null;
}

export function Login() {
    const { login, sessionExpired } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const demo = demoCredentials();

    const signIn = useMutation({
        mutationFn: (credentials: Credentials) =>
            login(credentials.email, credentials.password),
        onSuccess: () => void navigate("/projects", { replace: true }),
    });
    const apiError = asApiError(signIn.error);
    const error = signIn.isError
        ? (apiError?.message ?? "Something went wrong. Try again.")
        : null;
    const signingInAsDemo =
        signIn.isPending && signIn.variables?.email === demo?.email;

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        signIn.mutate({ email, password });
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
                    <PasswordField
                        label="Password"
                        name="password"
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
                    loading={signIn.isPending && !signingInAsDemo}
                    disabled={signingInAsDemo}
                    className="w-full"
                >
                    Sign in
                </Button>
            </form>

            {demo && (
                <div className="mt-6 border-t border-hairline pt-6">
                    <Button
                        variant="secondary"
                        className="w-full"
                        loading={signingInAsDemo}
                        disabled={signIn.isPending && !signingInAsDemo}
                        onClick={() => signIn.mutate(demo)}
                    >
                        Try the demo
                    </Button>
                    <p className="mt-2 text-center text-xs text-muted">
                        Signs in as an admin of two sample projects. Changes
                        reset nightly.
                    </p>
                </div>
            )}
        </AuthShell>
    );
}
