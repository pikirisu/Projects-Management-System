import rateLimit from "express-rate-limit";
import { ApiError } from "../utils/api-error.js";

const toPositiveInt = (value, fallback) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const shared = {
    standardHeaders: true,
    legacyHeaders: false,
    // The library answers in plain text; this keeps the JSON envelope.
    handler: (req, res, next, options) =>
        next(new ApiError(429, options.message)),
    // Read per request, so the flag works however modules were imported.
    skip: () => process.env.RATE_LIMIT_ENABLED === "false",
};

export const globalLimiter = rateLimit({
    ...shared,
    windowMs: toPositiveInt(process.env.RATE_LIMIT_WINDOW_MS, FIFTEEN_MINUTES),
    limit: toPositiveInt(process.env.RATE_LIMIT_MAX, 300),
    message: "Too many requests, please try again later",
});

// Login, register and the token-mailing endpoints. Only failed attempts count,
// so a person signing in successfully never uses up their budget.
export const authLimiter = rateLimit({
    ...shared,
    windowMs: toPositiveInt(
        process.env.AUTH_RATE_LIMIT_WINDOW_MS,
        FIFTEEN_MINUTES,
    ),
    limit: toPositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 20),
    message: "Too many authentication attempts, please try again later",
    skipSuccessfulRequests: true,
});
