/**
 * Where a verification email should point: the client's /verify-email/:token
 * route when EMAIL_VERIFICATION_REDIRECT_URL is set, so the person clicking it
 * sees a page instead of raw JSON, and the API endpoint itself otherwise.
 */
export function buildVerificationLink({ clientUrl, apiOrigin, token }) {
    const base = clientUrl?.trim();

    if (base) {
        // A trailing slash in the env var would otherwise produce "//token".
        return `${base.replace(/\/+$/, "")}/${token}`;
    }

    return `${apiOrigin}/api/v1/auth/verify-email/${token}`;
}
