/**
 * Custom application errors with appropriate HTTP status codes.
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required. Please sign in.') {
    super(message, 401, 'AUTHENTICATION_REQUIRED');
  }
}

export class SrmSessionExpiredError extends AppError {
  constructor(message = 'Your SRM portal session has expired. Please log in again.') {
    super(message, 401, 'SRM_SESSION_EXPIRED');
  }
}

export class SrmServiceError extends AppError {
  constructor(message = 'Failed to communicate with SRM portal.', statusCode = 502) {
    super(message, statusCode, 'SRM_SERVICE_ERROR');
  }
}

