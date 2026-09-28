// Runs with `npm run test:unit`. No server and no database, unlike
// scripts/verify.mjs -- this is the part that can be checked without either.
//
// The script names this file explicitly rather than pointing node --test at a
// directory or a glob. Neither is portable: `node --test src/` resolves the
// path as a module on Node 22 (src/ -> src/index.js, which boots a real
// server and never exits) while searching it for test files on Node 20, and
// glob arguments only work from Node 21 on, below the engines floor. New unit
// test files go in the script alongside this one.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVerificationLink } from "./verification-link.js";

const apiOrigin = "https://api.example.com";
const token = "tok-123";

describe("buildVerificationLink", () => {
    it("points at the client route when one is configured", () => {
        assert.equal(
            buildVerificationLink({
                clientUrl: "https://app.example.com/verify-email",
                apiOrigin,
                token,
            }),
            "https://app.example.com/verify-email/tok-123",
        );
    });

    it("does not emit a double slash for a trailing-slash base", () => {
        assert.equal(
            buildVerificationLink({
                clientUrl: "https://app.example.com/verify-email///",
                apiOrigin,
                token,
            }),
            "https://app.example.com/verify-email/tok-123",
        );
    });

    it("tolerates stray whitespace, which .env files collect easily", () => {
        assert.equal(
            buildVerificationLink({
                clientUrl: "  https://app.example.com/verify-email  ",
                apiOrigin,
                token,
            }),
            "https://app.example.com/verify-email/tok-123",
        );
    });

    it("falls back to the API endpoint when unset or blank", () => {
        const expected = `${apiOrigin}/api/v1/auth/verify-email/${token}`;

        for (const clientUrl of [undefined, "", "   "]) {
            assert.equal(
                buildVerificationLink({ clientUrl, apiOrigin, token }),
                expected,
                `clientUrl=${JSON.stringify(clientUrl)}`,
            );
        }
    });
});
