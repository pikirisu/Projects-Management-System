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
            className="bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
        >
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
                <p className="text-xs">
                    {resend.isSuccess
                        ? `A new verification link is on its way to ${user.email}. It expires in 20 minutes.`
                        : resend.error instanceof ApiError
                          ? resend.error.message
                          : `Your email address is not verified yet. Check ${user.email} for the link.`}
                </p>
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
        </div>
    );
}
