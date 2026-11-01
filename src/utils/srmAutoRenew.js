import { SrmSessionExpiredError } from './errors.js';
import { authService } from '../services/auth.service.js';

/**
 * Execute an SRM report or transaction operation with transparent auto-renewal.
 * If the university Tomcat session times out due to inactivity and throws
 * SrmSessionExpiredError, this helper uses the session's saved credentials to
 * re-authenticate in the background and retries the operation once.
 *
 * @param {import('express').Request} req - Active Express request containing session
 * @param {() => Promise<any>} operation - Async operation to execute
 * @returns {Promise<any>} Result of the operation
 */
export async function withSrmAutoRenew(req, operation) {
  try {
    return await operation();
  } catch (err) {
    const hasSavedCredentials = Boolean(
      req.session?.savedCredentials?.username && req.session?.savedCredentials?.password
    );

    // Only attempt transparent re-authentication if session expired and credentials exist
    if (err instanceof SrmSessionExpiredError && hasSavedCredentials) {
      const { username, password } = req.session.savedCredentials;
      console.info(`[SRM Session Renew] University session timed out for ${username}. Re-authenticating in background...`);

      try {
        await authService.login({
          username,
          password,
          expressSession: req.session
        });

        // Retry the original operation with the newly allocated university session
        return await operation();
      } catch (renewalErr) {
        console.warn(`[SRM Session Renew] Automatic re-authentication failed: ${renewalErr.message}`);
        throw err; // Throw original session expired error if re-login fails
      }
    }

    throw err;
  }
}
