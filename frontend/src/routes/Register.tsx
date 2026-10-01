import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../context/auth";
import { asApiError } from "../lib/api";
import { PASSWORD_MIN_LENGTH } from "../lib/constants";
import { AuthShell } from "../components/AuthShell";
import { Alert, Button, Field, PasswordField } from "../components/ui";

export function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [fullName, setFullName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const create = useMutation({
        mutationFn: () =>
            register({
                email,
                username,
                password,
                fullName: fullName.trim() || undefined,
            }),
        onSuccess: () => void navigate("/projects", { replace: true }),
    });
    const error = asApiError(create.error);
    const tooShort =
        password.length > 0 && password.length < PASSWORD_MIN_LENGTH;

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!tooShort) create.mutate();
    }

    return (
        <AuthShell
            title="Create your account"
            subtitle="Set up projects, invite your team, and assign work."
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
                {create.isError && (
                    <Alert>
                        {error?.message ?? "Something went wrong. Try again."}
                    </Alert>
                )}

                <Field
                    label="Full name"
                    name="fullName"
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    hint="Optional. Shown to your teammates."
                    error={error?.fieldErrors.fullName}
                />

                <Field
                    label="Username"
                    name="username"
                    autoComplete="username"
                    required
                    minLength={3}
                    value={username}
                    // The API refuses uppercase, so lowercase as they type.
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

                <PasswordField
                    label="Password"
                    name="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
                    error={
                        tooShort
                            ? `Use at least ${PASSWORD_MIN_LENGTH} characters`
                            : error?.fieldErrors.password
                    }
                />

                <Button
                    type="submit"
                    loading={create.isPending}
                    disabled={tooShort}
                    className="w-full"
                >
                    Create account
                </Button>
            </form>
        </AuthShell>
    );
}
