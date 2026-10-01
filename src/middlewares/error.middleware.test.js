import assert from "node:assert/strict";
import { describe, it } from "node:test";
import multer from "multer";
import { ApiError } from "../utils/api-error.js";
import { toApiError } from "./error.middleware.js";

const httpError = (status, message) =>
    Object.assign(new Error(message), { status, expose: true });

describe("toApiError", () => {
    it("passes an ApiError through untouched", () => {
        const error = new ApiError(403, "Forbidden");
        assert.equal(toApiError(error), error);
    });

    it("says how many files are allowed instead of 'Unexpected field'", () => {
        const error = toApiError(
            new multer.MulterError("LIMIT_UNEXPECTED_FILE", "attachments"),
        );
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /at most 5 files/);
    });

    it("keeps multer's message for a genuinely unknown field", () => {
        const error = toApiError(
            new multer.MulterError("LIMIT_UNEXPECTED_FILE", "avatar"),
        );
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /Unexpected field/);
    });

    it("answers an oversized file with 413", () => {
        const error = toApiError(
            new multer.MulterError("LIMIT_FILE_SIZE", "avatar"),
        );
        assert.equal(error.statusCode, 413);
    });

    it("keeps body-parser rejections in the 4xx range", () => {
        assert.equal(toApiError(httpError(413, "too large")).statusCode, 413);
        assert.equal(
            toApiError(httpError(400, "Unexpected token")).statusCode,
            400,
        );
    });

    it("names the field a unique index refused", () => {
        const duplicate = Object.assign(new Error("E11000"), {
            code: 11000,
            keyPattern: { email: 1 },
        });
        const error = toApiError(duplicate);
        assert.equal(error.statusCode, 409);
        assert.equal(error.message, "That email is already in use");
    });

    it("answers a malformed id with 400", () => {
        const cast = Object.assign(new Error("Cast to ObjectId failed"), {
            name: "CastError",
            path: "_id",
        });
        assert.equal(toApiError(cast).statusCode, 400);
    });

    it("leaves anything unexpected to become a 500", () => {
        assert.equal(toApiError(new TypeError("boom")), null);
        assert.equal(toApiError(httpError(500, "not a client error")), null);
    });
});
