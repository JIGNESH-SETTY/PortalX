/**
 * Higher-order utility function to wrap asynchronous Express route handlers.
 * Automatically catches any rejected promises and forwards errors to next().
 * This prevents repetitive try/catch boilerplate across controllers.
 *
 * @param {Function} fn - Asynchronous Express controller function (req, res, next)
 * @returns {Function} Express route handler with error forwarding
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

