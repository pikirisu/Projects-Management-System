import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth";
import { ApiError } from "../lib/api";
import { AuthShell } from "../components/AuthShell";
import { Alert, Button, Field } from "../components/ui";

export function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();

    const [fullName, setFullName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<ApiError | null>(null);

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            await register({
                email,
                username,
                password,
                fullName: fullName.trim() || undefined,
            });
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
            title="Create an account"
            subtitle="Set up projects, invite members, and assign work."
            footer={
                <>
                    Already registered?{" "}
                    <Link
                        to="/login"
                        className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                        Sign in
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {error && <Alert>{error.message}</Alert>}

                <Field
                    label="Full name"
                    name="fullName"
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    hint="Optional."
                    error={error?.fieldErrors.fullName}
                />

                <Field
                    label="Username"
                    name="username"
                    autoComplete="username"
                    required
                    minLength={3}
                    value={username}
                    /*
                     * The API rejects any uppercase character outright
                     * (userRegisterValidator uses isLowercase). Lowercasing as
                     * the user types turns a guaranteed 422 into a non-event.
                     */
                    onChange={(event) =>
                        setUsername(event.target.value.toLowerCase())
                    }
                    hint="Lowercase, at least 3 characters."
                    error={error?.fieldErrors.username}
                />

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

                <Field
                    label="Password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    error={error?.fieldErrors.password}
                />

                <Button type="submit" loading={submitting} className="w-full">
                    Create account
                </Button>
            </form>
        </AuthShell>
    );
}
