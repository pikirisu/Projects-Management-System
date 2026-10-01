import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const TEMPORARY_TOKEN_TTL_MS = 20 * 60 * 1000;

export const hashToken = (token) =>
    crypto.createHash("sha256").update(token).digest("hex");

// Decision: email links carry a random token, but only its sha256 is stored,
// so a leaked database row cannot be replayed as a verification or reset link.
export function createTemporaryToken() {
    const token = crypto.randomBytes(20).toString("hex");
    return {
        token,
        hashedToken: hashToken(token),
        expiresAt: new Date(Date.now() + TEMPORARY_TOKEN_TTL_MS),
    };
}

/** The decoded JWT payload, or null for any token that fails verification. */
export function verifyToken(token, secret) {
    try {
        return jwt.verify(token, secret);
    } catch {
        return null;
    }
}

// Decision: a JWT cannot be revoked on its own, but every token a user holds
// can be revoked at once by refusing anything issued before their credentials
// last changed. Compared in whole seconds because `iat` has one-second
// resolution: a sign-in in the same second as a password reset must survive.
export function isTokenStale(issuedAtSeconds, credentialsChangedAt) {
    if (!credentialsChangedAt) return false;
    // A token that does not say when it was issued gets no benefit of the doubt.
    if (!Number.isFinite(issuedAtSeconds)) return true;

    const changedAtSeconds = Math.floor(
        new Date(credentialsChangedAt).getTime() / 1000,
    );
    if (!Number.isFinite(changedAtSeconds)) return false;

    return issuedAtSeconds < changedAtSeconds;
}
