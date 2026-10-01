import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import {
    createTemporaryToken,
    hashToken,
    isTokenStale,
    verifyToken,
} from "./tokens.js";

const at = (seconds, ms = 0) => new Date(seconds * 1000 + ms);

test("isTokenStale", async (t) => {
    await t.test("nothing has invalidated the account", () => {
        assert.equal(isTokenStale(1000, undefined), false);
        assert.equal(isTokenStale(1000, null), false);
    });

    await t.test("a token minted before the change is stale", () => {
        assert.equal(isTokenStale(999, at(1000)), true);
        assert.equal(isTokenStale(0, at(1000)), true);
    });

    await t.test("a token minted after the change is not", () => {
        assert.equal(isTokenStale(1001, at(1000)), false);
    });

    await t.test("a token minted in the same second survives", () => {
        // iat is whole seconds, so a sign-in 200ms after a reset reports an
        // iat 800ms before it. Rejecting that would intermittently refuse the
        // login a reset exists to enable.
        assert.equal(isTokenStale(1000, at(1000, 1)), false);
        assert.equal(isTokenStale(1000, at(1000, 999)), false);
    });

    await t.test("a token without a numeric iat is stale", () => {
        for (const iat of [undefined, null, "1000", NaN, Infinity]) {
            assert.equal(isTokenStale(iat, at(1000)), true, String(iat));
        }
    });

    await t.test("accepts anything Date can parse", () => {
        assert.equal(isTokenStale(999, at(1000).toISOString()), true);
        assert.equal(isTokenStale(1001, at(1000).getTime()), false);
    });
});

test("createTemporaryToken stores only a hash of what it hands out", () => {
    const { token, hashedToken, expiresAt } = createTemporaryToken();

    assert.match(token, /^[0-9a-f]{40}$/);
    assert.equal(hashedToken, hashToken(token));
    assert.notEqual(hashedToken, token);
    assert.ok(expiresAt.getTime() > Date.now());
});

test("verifyToken returns the payload or null, never throws", () => {
    const good = jwt.sign({ _id: "u1" }, "secret");

    assert.equal(verifyToken(good, "secret")._id, "u1");
    assert.equal(verifyToken(good, "other-secret"), null);
    assert.equal(verifyToken("not-a-jwt", "secret"), null);
});
