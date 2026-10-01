/** An error with an HTTP status, answered as-is by the central error handler. */
export class ApiError extends Error {
    constructor(statusCode, message = "Something went wrong", errors = []) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
    }
}
