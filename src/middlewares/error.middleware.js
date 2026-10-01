import multer from "multer";
import { ApiError } from "../utils/api-error.js";
import { ATTACHMENT_FIELD, MAX_ATTACHMENTS } from "./multer.middleware.js";

/**
 * Maps anything a request can throw to an ApiError, or to null when it is an
 * unexpected fault. Pure, so it is unit-tested on its own.
 */
export function toApiError(err) {
    if (err instanceof ApiError) return err;

    if (err instanceof multer.MulterError) {
        // multer reports one file too many as an unexpected file on that field.
        const tooMany =
            err.code === "LIMIT_UNEXPECTED_FILE" &&
            err.field === ATTACHMENT_FIELD;
        return new ApiError(
            err.code === "LIMIT_FILE_SIZE" ? 413 : 400,
            tooMany
                ? `You can attach at most ${MAX_ATTACHMENTS} files at once`
                : err.message,
            err.field ? [{ [err.field]: err.code }] : [],
        );
    }

    // express.json() marks its own rejections (too large, malformed) `expose`.
    if (err?.expose === true && err.status >= 400 && err.status < 500) {
        return new ApiError(
            err.status,
            err.status === 413 ? "Request body is too large" : err.message,
        );
    }

    // A unique index refused the write.
    if (err?.code === 11000) {
        const fields = Object.keys(err.keyPattern ?? {});
        return new ApiError(
            409,
            fields.length === 1
                ? `That ${fields[0]} is already in use`
                : "A record with that value already exists",
            fields,
        );
    }

    if (err?.name === "CastError") {
        return new ApiError(400, `Invalid value for ${err.path}`);
    }
    if (err?.name === "ValidationError" || err?.name === "BSONError") {
        return new ApiError(400, err.message);
    }

    return null;
}

// Decision: every error leaves in the same envelope, and a 500 never echoes its
// message: internal details go to the server log, not to the client.
export function errorHandler(err, req, res, _next) {
    let error = toApiError(err);
    if (!error) {
        console.error(err);
        error = new ApiError(500, "Internal Server Error");
    }

    res.status(error.statusCode).json({
        statusCode: error.statusCode,
        data: null,
        message: error.message,
        success: false,
        errors: error.errors,
    });
}
