// Must be the first import: ES module imports are evaluated before any
// statement in this file runs, so calling dotenv.config() further down would
// leave process.env empty while app.js and its dependencies are being loaded.
import "dotenv/config";

import app from "./app.js";
import connectDB from "./db/index.js";

const port = process.env.PORT || 3000;

connectDB()
    .then(() => {
        // Bind all interfaces explicitly. Node would already do this by default,
        // but a container or PaaS routes traffic to the container's own address,
        // not loopback -- so making it explicit removes any doubt about why a
        // deployed service is unreachable while the logs say it started fine.
        app.listen(port, "0.0.0.0", () => {
            console.log(`Server listening on port ${port}`);
        });
    })
    .catch((err) => {
        console.error("MongoDB connection error", err);
        process.exit(1);
    });
