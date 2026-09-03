import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();

const publicDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../public",
);

// Behind a reverse proxy the client IP arrives in X-Forwarded-For; without this
// every request looks like it came from the proxy and the rate limiter becomes
// a global kill switch. Left off by default so it cannot be spoofed locally.
if (process.env.TRUST_PROXY) {
    app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);
}

// security headers
app.use(helmet());

// basic configurations
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(
    express.static(publicDir, {
        setHeaders: (res) => {
            // Everything under public/ is user-uploaded. Force a download and
            // forbid MIME sniffing so an uploaded file can never be executed as
            // same-origin script, even if it slips past the upload allowlist.
            res.setHeader("Content-Disposition", "attachment");
            res.setHeader("X-Content-Type-Options", "nosniff");
        },
    }),
);
app.use(cookieParser());

// cors configurations
const corsOrigin = process.env.CORS_ORIGIN?.trim();
if (corsOrigin === "*") {
    console.warn(
        "[cors] CORS_ORIGIN is '*' with credentials enabled — every origin may " +
            "send authenticated requests. Set an explicit origin list before deploying.",
    );
}
app.use(
    cors({
        // `true` reflects the caller's origin, which is the only way a wildcard
        // can coexist with credentialed requests; browsers reject a literal
        // `Access-Control-Allow-Origin: *` when cookies are in play.
        origin:
            !corsOrigin || corsOrigin === "*"
                ? true
                : corsOrigin.split(",").map((entry) => entry.trim()),
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    }),
);

//  import the routes

import healthCheckRouter from "./routes/healthcheck.routes.js";
import authRouter from "./routes/auth.routes.js";
import projectRouter from "./routes/project.routes.js";
import taskRouter from "./routes/task.routes.js";
import noteRouter from "./routes/note.routes.js";
import { ApiError } from "./utils/api-error.js";
import { globalLimiter } from "./middlewares/rate-limit.middleware.js";

app.use("/api/v1", globalLimiter);

app.use("/api/v1/healthcheck", healthCheckRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/tasks", taskRouter);
app.use("/api/v1/notes", noteRouter);

app.get("/", (req, res) => {
    res.send("Welcome to PMP");
});

// Centralized error handler - must be the last app.use()
app.use((err, req, res, next) => {
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            statusCode: err.statusCode,
            data: err.data,
            message: err.message,
            success: err.success,
            errors: err.errors,
        });
    }

    // Multer rejects oversized or disallowed uploads with its own error type,
    // which would otherwise surface as an opaque 500.
    if (err instanceof multer.MulterError) {
        const statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(statusCode).json({
            statusCode,
            data: null,
            message: err.message,
            success: false,
            errors: err.field ? [{ [err.field]: err.code }] : [],
        });
    }

    // Mongo duplicate key: a unique index rejected the write. This is a client
    // conflict (409), not a server fault.
    if (err?.code === 11000) {
        return res.status(409).json({
            statusCode: 409,
            data: null,
            message: "A record with that value already exists",
            success: false,
            errors: Object.keys(err.keyPattern ?? {}),
        });
    }

    if (
        err?.name === "ValidationError" ||
        err?.name === "CastError" ||
        err?.name === "BSONError"
    ) {
        return res.status(400).json({
            statusCode: 400,
            data: null,
            message: err.message,
            success: false,
            errors: [],
        });
    }

    console.error(err);
    return res.status(500).json({
        statusCode: 500,
        data: null,
        message: err?.message || "Internal Server Error",
        success: false,
        errors: [],
    });
});

export default app;
