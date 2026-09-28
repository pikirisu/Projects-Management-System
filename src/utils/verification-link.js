/**
 * Where a verification email should point.
 *
 * The API's own GET /auth/verify-email/:token answers JSON, so linking straight
 * at it means whoever clicks the link in their inbox lands on a page of raw
 * JSON -- and with REQUIRE_EMAIL_VERIFICATION on, that link is the only way
 * into the product. `clientUrl` (EMAIL_VERIFICATION_REDIRECT_URL) points at a
 * client route that calls the endpoint and renders the outcome instead,
 * mirroring how FORGOT_PASSWORD_REDIRECT_URL already works for password resets.
 *
 * Falling back to the direct API link keeps an existing deployment that has not
 * added the variable working, rather than emailing a link to a 404.
 *
 * @param {object} options
 * @param {string|undefined} options.clientUrl Frontend base, token appended.
 * @param {string} options.apiOrigin e.g. "https://api.example.com".
 * @param {string} options.token The unhashed token that goes in the link.
 */
export function buildVerificationLink({ clientUrl, apiOrigin, token }) {
    const base = clientUrl?.trim();

    if (base) {
        // A trailing slash in the env var would otherwise produce "//token",
        // which some routers treat as a different path than the one declared.
        return `${base.replace(/\/+$/, "")}/${token}`;
    }

    return `${apiOrigin}/api/v1/auth/verify-email/${token}`;
}
