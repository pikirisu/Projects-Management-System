/*
 * Bulk revocation for stateless access tokens.
 *
 * A JWT cannot be revoked individually without a server-side denylist, but
 * every token a user holds can be revoked at once by recording when their
 * credentials last changed and refusing anything older. That is exactly the
 * grain a password change needs: end every session, keep none.
 */
export function isTokenStale(issuedAtSeconds, credentialsChangedAt) {
    if (!credentialsChangedAt) {
        // Nothing has ever invalidated this account's sessions.
        return false;
    }

    if (!Number.isFinite(issuedAtSeconds)) {
        // A token that will not say when it was issued cannot be shown to
        // post-date the change, so it does not get the benefit of the doubt.
        return true;
    }

    const changedAtSeconds = Math.floor(
        new Date(credentialsChangedAt).getTime() / 1000,
    );

    if (!Number.isFinite(changedAtSeconds)) {
        // Unreachable through Mongoose, which casts the field to a Date or
        // rejects the write. Returning false keeps the helper total without
        // inventing a state that locks an account out with no way back.
        return false;
    }

    /*
     * Both sides are compared in whole seconds, and a token minted in the
     * same second as the change survives. `iat` floors away up to 999ms, so
     * a sign-in 200ms after a reset can look 800ms older than the reset --
     * a stricter comparison would intermittently refuse the login that a
     * password reset exists to enable.
     */
    return issuedAtSeconds < changedAtSeconds;
}
