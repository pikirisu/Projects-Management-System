// Must be the first import: ES modules evaluate every import before running any
// statement, so a later dotenv.config() would run after app.js read process.env.
import "dotenv/config";

import app from "./app.js";
import connectDB from "./db/index.js";

const port = process.env.PORT || 8000;

try {
    await connectDB();
    // Every interface, not just loopback: a container is reached on its own
    // address.
    app.listen(port, "0.0.0.0", () => {
        console.log(`Server listening on port ${port}`);
    });
} catch (error) {
    console.error("MongoDB connection error", error);
    process.exit(1);
}
