// Runs with `npm run test:unit`. Only the pure helper is covered here; the
// upload and delete drivers need a real Cloudinary account or a filesystem, and
// scripts/verify.mjs exercises those against a live server.

import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { resolveLocalPath } from "./storage.js";

const LOCAL_DIR = path.resolve(import.meta.dirname, "../../public/images");

describe("resolveLocalPath", () => {
    it("resolves an ordinary key inside the upload directory", () => {
        assert.equal(
            resolveLocalPath("0f8b1a2c-3d4e-4f50-9a6b-7c8d9e0f1a2b.png"),
            path.join(LOCAL_DIR, "0f8b1a2c-3d4e-4f50-9a6b-7c8d9e0f1a2b.png"),
        );
    });

    it("refuses to escape the upload directory", () => {
        // Keys are UUIDs the server writes, so these only arise from an older
        // row, a restored backup, or a database edited by hand -- but an
        // unlink() on any of them would delete a real file outside public/.
        for (const key of [
            "../app.js",
            "../../src/app.js",
            "sub/../../escape.txt",
            "/etc/passwd",
        ]) {
            assert.throws(
                () => resolveLocalPath(key),
                /outside the upload directory/,
                `expected ${key} to be refused`,
            );
        }
    });

    it("refuses a key that names a subdirectory", () => {
        // Nothing writes nested keys, so a nested one means the row is not
        // what this module produced.
        assert.throws(
            () => resolveLocalPath("nested/file.png"),
            /outside the upload directory/,
        );
    });
});
