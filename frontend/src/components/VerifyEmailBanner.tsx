import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/auth";
import { Button } from "./ui";

/*
 * Shown to a signed-in account whose address is still unverified.
 *
 * It matters more than it looks: with REQUIRE_EMAIL_VERIFICATION on, the next
 * sign-in is refused with a 403 and the only way forward is a fresh link --
 * which /auth/resend-email-verification will only send to an authenticated
 * caller. So the moment the session lapses, the account is stuck. This banner
 * is the one place the app offers that link while it can still be sent.
 */
export function VerifyEmailBanner() {
    const { user } = useAuth();

    const resend = useMutation({
        mutationFn: () => api.post("/auth/resend-email-verification"),
    });

    // `isEmailVerified` is absent on responses that do not project it; only an
    // explicit `false` means unverified.
    if (!user || user.isEmailVerified !== false) return null;

    return (
        <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
        >
            <div className="flex min-w-0 items-start gap-2.5">
                <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="mt-px size-4 shrink-0 opacity-80"
                >
                    <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0v-3.5ZM10 14a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z"
                        clipRule="evenodd"
                    />
                </svg>
                <p className="text-sm">
                    {resend.isSuccess
                        ? `A new verification link is on its way to ${user.email}. It expires in 20 minutes.`
                        : resend.error instanceof ApiError
                          ? resend.error.message
                          : `Your email address is not verified yet. Check ${user.email} for the link.`}
                </p>
            </div>
            {!resend.isSuccess && (
                <Button
                    variant="secondary"
                    size="sm"
                    loading={resend.isPending}
                    onClick={() => resend.mutate()}
                >
                    Resend link
                </Button>
            )}
        </div>
    );
}
