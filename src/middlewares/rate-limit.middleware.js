import rateLimit from "express-rate-limit";
import { ApiError } from "../utils/api-error.js";

const toPositiveInt = (value, fallback) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

// express-rate-limit replies with plain text by default; funnel it through
// ApiError so a throttled client sees the same JSON envelope as every other error.
const handler = (req, res, next, options) => {
    next(new ApiError(429, options.message));
};

// Evaluated per request rather than at module load, so toggling the flag does
// not depend on import ordering.
const disabled = () => process.env.RATE_LIMIT_ENABLED === "false";

const shared = { standardHeaders: true, legacyHeaders: false, handler };

export const globalLimiter = rateLimit({
    ...shared,
    windowMs: toPositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    limit: toPositiveInt(process.env.RATE_LIMIT_MAX, 300),
    message: "Too many requests, please try again later",
    skip: disabled,
});

// Credential-guessing surface: login, register, and the two token-mailing
// endpoints. Deliberately far stricter than the global limiter.
export const authLimiter = rateLimit({
    ...shared,
    windowMs: toPositiveInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    limit: toPositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 20),
    message: "Too many authentication attempts, please try again later",
    skipSuccessfulRequests: true,
    skip: disabled,
});
