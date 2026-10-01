const DAY = 86_400_000;
const UNIT_MS = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: DAY };

/** "15m", "1d", "10d" → milliseconds, so a cookie expires with its JWT. */
function durationToMs(value, fallbackMs) {
    const match = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(String(value ?? "").trim());
    return match ? Number(match[1]) * UNIT_MS[match[2] ?? "ms"] : fallbackMs;
}

export function getCookieOptions(maxAge) {
    const sameSite = process.env.COOKIE_SAMESITE || "strict";

    return {
        httpOnly: true,
        // Browsers drop SameSite=None cookies that are not Secure.
        secure: process.env.NODE_ENV === "production" || sameSite === "none",
        sameSite,
        ...(maxAge ? { maxAge } : {}),
    };
}

export const accessCookieOptions = () =>
    getCookieOptions(durationToMs(process.env.ACCESS_TOKEN_EXPIRY, DAY));

export const refreshCookieOptions = () =>
    getCookieOptions(durationToMs(process.env.REFRESH_TOKEN_EXPIRY, 10 * DAY));
