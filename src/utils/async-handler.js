/**
 * Wraps an async route handler so a rejected promise reaches Express's error
 * handler instead of becoming an unhandled rejection and hanging the request.
 */
const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        // promise/no-callback-in-promise targets Node-style (err, value)
        // callbacks smuggled into promise chains. `next` is not one of those:
        // it is Express's error channel, and handing it the rejection is
        // exactly what this wrapper exists to do.
        // oxlint-disable-next-line promise/no-callback-in-promise
        Promise.resolve(requestHandler(req, res, next)).catch(next);
    };
};

export { asyncHandler };
