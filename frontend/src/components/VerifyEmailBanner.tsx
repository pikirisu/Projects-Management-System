import { useMutation } from "@tanstack/react-query";
import { MailWarning } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../context/auth";
import { Button } from "./ui";

// Decision: resending a verification link needs a signed-in caller. With
// REQUIRE_EMAIL_VERIFICATION on, an unverified account that loses its session
// cannot sign in again, so this banner is the one place the link can still be
// requested.
export function VerifyEmailBanner() {
    const { user } = useAuth();
    const resend = useMutation({
        mutationFn: () => api.post("/auth/resend-email-verification"),
    });

    // Only an explicit false means unverified; some responses omit the field.
    if (!user || user.isEmailVerified !== false) return null;

    return (
        <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
        >
            <div className="flex min-w-0 items-start gap-2.5">
                <MailWarning
                    className="mt-0.5 size-4 shrink-0 opacity-80"
                    aria-hidden="true"
                />
                <p className="text-sm">
                    {resend.isSuccess
                        ? `A new verification link is on its way to ${user.email}. It expires in 20 minutes.`
                        : resend.isError
                          ? errorMessage(resend.error, "Could not send a link")
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
