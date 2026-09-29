// Runs with `npm run test:unit`. Only the pure helper is covered here; the
// upload and delete drivers need a real Cloudinary account or a filesystem, and
// scripts/verify.mjs exercises those against a live server.

import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { resolveLocalPath } from "./storage.js";

const LOCAL_DIR = path.resolve(import.meta.dirname, "../../public/images");
const AVATAR_DIR = path.resolve(import.meta.dirname, "../../public/avatars");

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

    it("resolves an avatar into its own directory", () => {
        assert.equal(
            resolveLocalPath("a1.png", "avatars"),
            path.join(AVATAR_DIR, "a1.png"),
        );
    });

    it("falls back to attachments for an unknown or missing folder", () => {
        // Every row written before avatars existed is an attachment and has no
        // folder at all; an unrecognised name must not widen the search.
        for (const folder of [undefined, "", "nope", "../public"]) {
            assert.equal(
                resolveLocalPath("a1.png", folder),
                path.join(LOCAL_DIR, "a1.png"),
            );
        }
    });

    it("refuses to escape an avatar directory too", () => {
        assert.throws(
            () => resolveLocalPath("../images/other.png", "avatars"),
            /outside the upload directory/,
        );
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
