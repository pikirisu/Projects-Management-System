import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "../lib/api";
import { AuthShell } from "../components/AuthShell";
import { Alert, Button, Spinner } from "../components/ui";

/**
 * The page the verification email links to. The endpoint is a GET that flips a
 * flag, so it runs on mount. No retry, since an expired token stays expired,
 * and no cache, so a second visit cannot show a stale success.
 */
export function VerifyEmail() {
    const { token = "" } = useParams();
    const navigate = useNavigate();

    const { isPending, error, isSuccess } = useQuery({
        queryKey: ["verify-email", token],
        queryFn: () => api.get(`/auth/verify-email/${token}`),
        retry: false,
        gcTime: 0,
        enabled: token.length > 0,
    });

    if (isPending) {
        return (
            <AuthShell
                title="Verifying your email"
                subtitle="This only takes a moment."
                footer={null}
            >
                <div className="flex items-center gap-2 text-sm text-muted">
                    <Spinner />
                    Checking your link…
                </div>
            </AuthShell>
        );
    }

    if (isSuccess) {
        return (
            <AuthShell
                title="Email verified"
                subtitle="Your address is confirmed. You can sign in now."
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
            title="That link did not work"
            subtitle="Verification links expire 20 minutes after they are sent."
            footer={
                <>
                    Already verified?{" "}
                    <Link
                        to="/login"
                        className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                        Sign in
                    </Link>
                </>
            }
        >
            <div className="space-y-4">
                <Alert>
                    {errorMessage(error, "Could not verify this link.")}
                </Alert>
                {/* Resending needs a session, so the way back is to sign in. */}
                <p className="text-sm text-muted">
                    Sign in and use the banner at the top of the page to send
                    yourself a new link.
                </p>
            </div>
        </AuthShell>
    );
}
