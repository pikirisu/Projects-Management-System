/** The envelope every successful response uses. */
export class ApiResponse {
    constructor(statusCode, data, message = "Success") {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400;
    }
}

/** Sends `data` in the standard envelope. */
export const respond = (res, data, message, status = 200) =>
    res.status(status).json(new ApiResponse(status, data, message));
