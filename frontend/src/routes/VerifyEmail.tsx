import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { AuthShell } from "../components/AuthShell";
import { Alert, Button, Spinner } from "../components/ui";

/*
 * The endpoint behind this is a GET that flips a flag, so it runs on mount
 * rather than behind a button. `retry: false` matters: an expired token is a
 * permanent 400, and retrying it would just delay the explanation. `gcTime: 0`
 * keeps a second visit to the same link from reading a cached success and
 * claiming to have verified a token the server has already spent.
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
                    {error instanceof ApiError
                        ? error.message
                        : "Could not verify this link."}
                </Alert>
                {/*
                 * Resending needs an authenticated caller, so the only route
                 * back is to sign in -- the banner in the app offers it there.
                 */}
                <p className="text-sm text-muted">
                    Sign in and use the banner at the top of the page to send
                    yourself a new link.
                </p>
            </div>
        </AuthShell>
    );
}
