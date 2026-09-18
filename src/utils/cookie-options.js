// Translates a jsonwebtoken-style duration ("15m", "1d", "10d") into milliseconds
// so an auth cookie expires alongside the token it carries, instead of lingering
// as a session cookie that outlives its own JWT.
const durationToMs = (value, fallbackMs) => {
    const match = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(String(value ?? "").trim());
    if (!match) {
        return fallbackMs;
    }
    const multipliers = {
        ms: 1,
        s: 1000,
        m: 60_000,
        h: 3_600_000,
        d: 86_400_000,
    };
    return Number(match[1]) * multipliers[match[2] ?? "ms"];
};

const DAY = 86_400_000;

export const getCookieOptions = (maxAge) => {
    const sameSite = process.env.COOKIE_SAMESITE || "strict";

    return {
        httpOnly: true,
        // Browsers silently drop SameSite=None cookies that are not Secure, so a
        // cross-site frontend forces HTTPS whether or not NODE_ENV says production.
        secure: process.env.NODE_ENV === "production" || sameSite === "none",
        sameSite,
        ...(maxAge ? { maxAge } : {}),
    };
};

export const accessCookieOptions = () =>
    getCookieOptions(durationToMs(process.env.ACCESS_TOKEN_EXPIRY, DAY));

export const refreshCookieOptions = () =>
    getCookieOptions(durationToMs(process.env.REFRESH_TOKEN_EXPIRY, 10 * DAY));
