import { AuthenticationError } from '../utils/errors.js';
import { config } from '../config/env.js';

/**
 * Middleware to enforce authentication on protected PortalX API routes.
 * Verifies that the Express session contains an active student identifier.
 */
export function requireAuth(req, res, next) {
  // If the user has an active session with a registered studentId
  if (req.session && req.session.studentId) {
    return next();
  }

  // If local development mock mode is enabled, allow unauthenticated mock access
  if (config.devMockFallback) {
    req.session.studentId = req.session.studentId || 'AP25110010807';
    req.isMockDevSession = true;
    return next();
  }

  throw new AuthenticationError('Authentication required. Please sign in with your SRM credentials.');
}

