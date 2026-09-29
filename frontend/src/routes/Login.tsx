import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth";
import { ApiError } from "../lib/api";
import { AuthShell } from "../components/AuthShell";
import { Alert, Button, Field } from "../components/ui";

export function Login() {
    const { login, sessionExpired } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<ApiError | null>(null);

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            await login(email, password);
            navigate("/projects", { replace: true });
        } catch (caught) {
            setError(
                caught instanceof ApiError
                    ? caught
                    : new ApiError(0, "Something went wrong. Try again."),
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <AuthShell
            title="Sign in"
            subtitle="Access your projects and tasks."
            footer={
                <>
                    No account yet?{" "}
                    <Link
                        to="/register"
                        className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                        Create one
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/*
                 * Shown when the app signed the user out rather than the user
                 * doing it. A session that simply stops working is otherwise
                 * indistinguishable from the app having lost their work, and
                 * this is the only screen they are left on to explain it. It
                 * gives way to a failed sign-in: that message is the newer news.
                 */}
                {sessionExpired && !error && (
                    <Alert tone="info">
                        Your session ended. This happens when a password is
                        changed or a session is left for too long. Sign in to
                        pick up where you left off.
                    </Alert>
                )}

                {/*
                 * Only the top-level message is shown for a failed sign-in. The
                 * API deliberately answers 401 "Invalid credentials" for both an
                 * unknown address and a wrong password, and attaching that to a
                 * specific field would undo it by revealing which one existed.
                 */}
                {error && <Alert>{error.message}</Alert>}

                <Field
                    label="Email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    error={error?.fieldErrors.email}
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
                        error={error?.fieldErrors.password}
                    />
                    <Link
                        to="/forgot-password"
                        className="mt-1.5 inline-block text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                        Forgot your password?
                    </Link>
                </div>

                <Button type="submit" loading={submitting} className="w-full">
                    Sign in
                </Button>
            </form>
        </AuthShell>
    );
}
