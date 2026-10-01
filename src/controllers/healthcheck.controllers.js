import mongoose from "mongoose";
import { ApiResponse } from "../utils/api-response.js";

const READY_STATES = [
    "disconnected",
    "connected",
    "connecting",
    "disconnecting",
];

// Decision: the healthcheck fails (503) when the database is unreachable. A
// host restarts or stops routing to an unhealthy service, and a 200 here would
// keep traffic flowing to a server that can only answer 500s.
export function healthCheck(req, res) {
    const state = mongoose.connection.readyState;
    const healthy = state === 1;
    const status = healthy ? 200 : 503;

    res.status(status).json(
        new ApiResponse(
            status,
            {
                uptime: Math.floor(process.uptime()),
                database: READY_STATES[state] ?? "unknown",
            },
            healthy ? "Healthy" : "Database unavailable",
        ),
    );
}
