import { AppError } from '../utils/errors.js';
import { config } from '../config/env.js';

/**
 * Central Express error-handling middleware.
 * Formats all errors into a consistent JSON response for the frontend:
 * {
 *   "ok": false,
 *   "data": null,
 *   "message": "Human-readable error message",
 *   "code": "ERROR_CODE"
 * }
 */
export function errorHandler(err, req, res, next) {
  let statusCode = 500;
  let message = 'An unexpected internal error occurred.';
  let code = 'INTERNAL_SERVER_ERROR';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
  } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
    statusCode = 504;
    message = 'Request to SRM portal timed out. The university server may be slow or temporarily unresponsive.';
    code = 'GATEWAY_TIMEOUT';
  } else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    statusCode = 502;
    message = 'Unable to connect to SRM portal. Please check network connectivity.';
    code = 'BAD_GATEWAY';
  } else if (err.name === 'SyntaxError' && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON request payload.';
    code = 'INVALID_JSON';
  } else if (err.statusCode) {
    statusCode = err.statusCode;
    message = err.message || message;
    code = err.code || code;
  }

  // Safe logging without leaking sensitive cookies, passwords, or personal data
  if (config.nodeEnv !== 'test') {
    console.error(`[Error] ${req.method} ${req.originalUrl} - ${statusCode} [${code}]: ${err.message}`);
  }

  res.status(statusCode).json({
    ok: false,
    data: null,
    message,
    code,
    ...(config.isProduction ? {} : { stack: err.stack })
  });
}

