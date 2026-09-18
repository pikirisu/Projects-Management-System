import mongoose from "mongoose";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

// mongoose.connection.readyState is an enum, not a boolean:
// 0 disconnected, 1 connected, 2 connecting, 3 disconnecting.
const READY_STATES = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
};

// A hosting platform restarts the service when this endpoint stops returning
// 2xx, so it has to fail when the process cannot actually serve requests.
// Reporting 200 while the database is unreachable is worse than useless: the
// platform keeps routing traffic to a server that can only answer 500s.
const healthCheck = asyncHandler(async (req, res) => {
    const state = mongoose.connection.readyState;
    const isHealthy = state === 1;

    const payload = {
        message: isHealthy ? "Server is running" : "Server is degraded",
        uptime: Math.floor(process.uptime()),
        database: READY_STATES[state] ?? "unknown",
    };

    res.status(isHealthy ? 200 : 503).json(
        new ApiResponse(
            isHealthy ? 200 : 503,
            payload,
            isHealthy ? "Healthy" : "Database unavailable",
        ),
    );
});

export { healthCheck };
