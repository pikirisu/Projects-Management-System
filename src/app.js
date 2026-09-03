import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

// basic configurations
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// cors configurations
app.use(
    cors({
        origin: process.env.CORS_ORIGIN?.split(",") || "http://locahost:5173",
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
