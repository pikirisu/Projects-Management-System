import express from "express";
import cors from "cors";

const app = express();

// Basic Configs
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));

// CORS Config
app.use(
    cors({
        origin: process.env.CORS_ORIGIN?.split[","] || "https://localhost:5172",
        allowHeaders: ["Content-Type", "Authorization"],
        methods: ["GET", "PUT", "POST", "PATCH", "DELETE", "HEAD", "OPTIONS"],
        credentials: true,
    }),
);

// Router Config
import healthCheckRouter from "./routes/healthcheck.routes.js";
import authRouter from "./routes/auth.routes.js";

app.use("/api/v1/healthcheck", healthCheckRouter);
app.use("/api/v1/auth", authRouter);

app.get("/", (req, res) => {
    res.send("Hello World!");
});

export default app;
