import test from "node:test";
import assert from "node:assert/strict";
import { isTokenStale } from "./token-freshness.js";

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
        // iat is whole seconds and Date is milliseconds, so a sign-in 200ms
        // after a reset reports an iat 800ms *before* it. Rejecting that would
        // make a password reset intermittently refuse the login it exists to
        // enable -- the failure would look random, once every few resets.
        assert.equal(isTokenStale(1000, at(1000, 1)), false);
        assert.equal(isTokenStale(1000, at(1000, 999)), false);
    });

    await t.test(
        "a token that will not say when it was issued is stale",
        () => {
            // jwt.sign always writes iat, so this is a token from somewhere else.
            for (const iat of [undefined, null, "1000", NaN, Infinity]) {
                assert.equal(
                    isTokenStale(iat, at(1000)),
                    true,
                    `expected ${String(iat)} to be treated as stale`,
                );
            }
        },
    );

    await t.test("accepts anything Date can parse", () => {
        assert.equal(isTokenStale(999, at(1000).toISOString()), true);
        assert.equal(isTokenStale(1001, at(1000).getTime()), false);
    });
});
