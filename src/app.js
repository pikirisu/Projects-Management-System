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
/*
 * Task attachments. Arbitrary file types reach this directory, so they are
 * forced to download and never sniffed: an uploaded file must not be able to
 * execute as same-origin script even if it slips past the upload allowlist.
 * The client links to these rather than embedding them, so a download is
 * exactly the behaviour wanted.
 */
app.use(
    "/images",
    express.static(path.join(publicDir, "images"), {
        setHeaders: (res) => {
            res.setHeader("Content-Disposition", "attachment");
            res.setHeader("X-Content-Type-Options", "nosniff");
        },
    }),
);

/*
 * Profile photos, which have to render in an <img> -- and did not.
 *
 * Two headers stopped them, and neither shows up in anything but a real
 * browser: helmet's default Cross-Origin-Resource-Policy: same-origin blocks
 * the load outright whenever the client is served from a different origin than
 * the API, which is the deployment this project documents; and the
 * Content-Disposition above turns an image into a download. A fetch() from
 * Node honours neither, so every test passed while the avatar was broken.
 *
 * Serving them inline is safe because of what may reach this directory: the
 * avatar allowlist is jpeg/png/gif/webp only. SVG is excluded precisely
 * because it is XML that can carry script, and nosniff stays so a file that is
 * not really an image cannot be reinterpreted as one that is.
 */
app.use(
    "/avatars",
    express.static(path.join(publicDir, "avatars"), {
        setHeaders: (res) => {
            res.setHeader("X-Content-Type-Options", "nosniff");
            res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
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
import {
    ATTACHMENT_FIELD,
    MAX_ATTACHMENTS,
} from "./middlewares/multer.middleware.js";
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
        /*
         * multer reports one file too many as LIMIT_UNEXPECTED_FILE on the
         * field it arrived under, so someone who attached six files was told
         * "Unexpected field" -- true of the sixth file, and no help at all to
         * the person who has to work out what to remove.
         */
        const tooMany =
            err.code === "LIMIT_UNEXPECTED_FILE" &&
            err.field === ATTACHMENT_FIELD;
        return res.status(statusCode).json({
            statusCode,
            data: null,
            message: tooMany
                ? `You can attach at most ${MAX_ATTACHMENTS} files at once`
                : err.message,
            success: false,
            errors: err.field ? [{ [err.field]: err.code }] : [],
        });
    }

    /*
     * express.json() rejects a body that is too large or not valid JSON before
     * any route sees it. Those arrive as http-errors carrying a 4xx status and
     * expose: true, which is the library's way of saying the message was
     * written for the client. Without this branch they fell through to the 500
     * below, so a client that sent 100kb was told the *server* had a problem --
     * and the 5xx rate counted requests that were never servable.
     */
    if (err?.expose === true && err?.status >= 400 && err?.status < 500) {
        const statusCode = err.status;
        return res.status(statusCode).json({
            statusCode,
            data: null,
            message:
                statusCode === 413 ? "Request body is too large" : err.message,
            success: false,
            errors: [],
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
