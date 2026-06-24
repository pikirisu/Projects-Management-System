import express from "express";

const app = express();

// Basic Configs
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));

// CORS config
app.use(
    cors({
        origin: process.env.CORS_ORIGIN?.split[","] || "https://localhost:5172",
        allowHeaders: ["Content-Type", "Authorization"],
        methods: ["GET", "PUT", "POST", "PATCH", "DELETE", "HEAD", "OPTIONS"],
        credentials: true,
    }),
);

app.get("/", (req, res) => {
    res.send("Hello World!");
});

export default app;
