// Must be the first import: ES module imports are evaluated before any
// statement in this file runs, so calling dotenv.config() further down would
// leave process.env empty while app.js and its dependencies are being loaded.
import "dotenv/config";

import app from "./app.js";
import connectDB from "./db/index.js";

const port = process.env.PORT || 3000;

connectDB()
    .then(() => {
        app.listen(port, () => {
            console.log(`Example app listening on port http://localhost:${port}`);
        });
    })
    .catch((err) => {
        console.error("MongoDB connection error", err);
        process.exit(1);
    });
