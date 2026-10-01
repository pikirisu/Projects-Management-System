import { validationResult } from "express-validator";
import { ApiError } from "../utils/api-error.js";

/** Answers 422 with one `{ field: message }` per invalid field. */
export function validate(req, res, next) {
    const errors = validationResult(req)
        .array()
        .map(({ path, msg }) => ({ [path]: msg }));

    if (errors.length > 0) {
        throw new ApiError(
            422,
            "Some of the submitted fields are invalid",
            errors,
        );
    }
    next();
}
