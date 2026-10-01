import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { errorHandler } from "./middlewares/error.middleware.js";
import { globalLimiter } from "./middlewares/rate-limit.middleware.js";
import authRouter from "./routes/auth.routes.js";
import healthCheckRouter from "./routes/healthcheck.routes.js";
import noteRouter from "./routes/note.routes.js";
import projectRouter from "./routes/project.routes.js";
import taskRouter from "./routes/task.routes.js";
import { UPLOAD_KINDS } from "./utils/storage.js";

const app = express();

// Decision: X-Forwarded-For is trusted only when TRUST_PROXY says how many
// proxies sit in front. Behind one, the rate limiter would otherwise see every
// client as the proxy; without one, trusting it would let clients spoof an IP.
if (process.env.TRUST_PROXY) {
    app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);
}

app.use(helmet());

// Decision: uploads are served from two directories with different headers.
// Attachments can be any allowlisted type, so they always download and keep
// helmet's same-origin resource policy. Avatars are raster images that must
// render in an <img> on the client's origin, so they are served inline and
// cross-origin. nosniff stays on both.
const { attachments, avatars } = UPLOAD_KINDS;
app.use(
    `/${attachments.urlPath}`,
    express.static(attachments.dir, {
        setHeaders(res) {
            res.setHeader("Content-Disposition", "attachment");
            res.setHeader("X-Content-Type-Options", "nosniff");
        },
    }),
);
app.use(
    `/${avatars.urlPath}`,
    express.static(avatars.dir, {
        setHeaders(res) {
            res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
            res.setHeader("X-Content-Type-Options", "nosniff");
        },
    }),
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
// Express 5 leaves req.body undefined when no parser ran; handlers read it.
app.use((req, res, next) => {
    req.body ??= {};
    next();
});
app.use(cookieParser());

const corsOrigin = process.env.CORS_ORIGIN?.trim();
const anyOrigin = !corsOrigin || corsOrigin === "*";
if (anyOrigin) {
    console.warn(
        "[cors] CORS_ORIGIN is not an explicit list, so any site may send " +
            "credentialed requests. Set it before deploying.",
    );
}
app.use(
    cors({
        // `true` reflects the caller's origin: with credentials, browsers
        // refuse a literal "*".
        origin: anyOrigin
            ? true
            : corsOrigin.split(",").map((origin) => origin.trim()),
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    }),
);

app.use("/api/v1", globalLimiter);
app.use("/api/v1/healthcheck", healthCheckRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/tasks", taskRouter);
app.use("/api/v1/notes", noteRouter);

app.get("/", (req, res) => res.send("Project Camp API"));

app.use(errorHandler);

export default app;
