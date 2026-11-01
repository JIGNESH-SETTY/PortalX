import { srmSessionService } from './srmSession.service.js';
import { srmClientService } from './srmClient.service.js';
import { captchaService } from './captcha.service.js';
import { analyticsService } from './analytics.service.js';
import { config } from '../config/env.js';
import { ValidationError, AuthenticationError } from '../utils/errors.js';

/** Maximum automated login cycles to retry on captcha or transient session rejections */
const MAX_LOGIN_ATTEMPTS = 3;

/** Maximum attempts to fetch and OCR a valid 5-character captcha per login cycle */
const MAX_CAPTCHA_FETCH_ATTEMPTS = 3;

/** Standard expected length of SRM University-AP alphanumeric captchas */
const CAPTCHA_LENGTH = 5;

/**
 * Fetch a fresh captcha image and solve it via OCR.
 * Retries fetching a new image if OCR yields an incomplete string (fewer than 5 chars).
 *
 * @param {string} sessionKey - Active isolated SRM session identifier
 * @returns {Promise<string>} Predicted 5-character uppercase captcha string
 */
async function fetchAndSolveCaptcha(sessionKey) {
  let fallbackCandidate = '';

  for (let attempt = 1; attempt <= MAX_CAPTCHA_FETCH_ATTEMPTS; attempt++) {
    try {
      const captchaImageBuffer = await srmClientService.fetchCaptchaImage(sessionKey);
      const solved = await captchaService.solve(captchaImageBuffer);

      // SRM captchas are 5 alphanumeric characters (1 letter + 4 digits e.g. "M9005", "Z7392")
      if (solved.length === CAPTCHA_LENGTH && /^[A-Z0-9]{5}$/i.test(solved)) {
        return solved;
      }

      // Keep 4-character result as fallback in case all attempts produce 4 chars
      if (solved.length >= 4 && solved.length <= 5 && !fallbackCandidate) {
        fallbackCandidate = solved;
      }

      console.warn(
        `[CaptchaService] Fetch ${attempt}/${MAX_CAPTCHA_FETCH_ATTEMPTS}: OCR predicted "${solved}" (${solved.length} chars) — fetching fresh image`
      );
    } catch (err) {
      console.warn(`[CaptchaService] Fetch ${attempt}/${MAX_CAPTCHA_FETCH_ATTEMPTS} error:`, err.message);
    }
  }

  return fallbackCandidate;
}

class AuthService {
  /**
   * Authenticate a student against the SRM student portal.
   *
   * @param {object} params
   * @param {string} params.username - Application Number / Register Number (e.g., AP25110010807)
   * @param {string} params.password - Student password
   * @param {string} [params.captcha] - CAPTCHA code if entered
   * @param {string} [params.srmSessionId] - Optional direct JSESSIONID for developer testing
   * @param {object} params.expressSession - Express request session
   * @param {boolean} [params.isAutoRenew=false] - Whether this login is an internal auto-renewal
   * @returns {Promise<{ ok: boolean, studentId: string, message: string }>}
   */
  async login({ username, password, captcha, srmSessionId, expressSession, isAutoRenew = false }) {
    if (!username || typeof username !== 'string') {
      throw new ValidationError('Register Number is required.');
    }

    const trimmedInput = username.trim();

    // ── Administrator Authentication ─────────────────────────────────────
    // Seamlessly authenticate administrator using email in the primary login input
    const ADMIN_EMAIL = 'jignesh.setty@gmail.com';
    const ADMIN_PASSWORD = 'portalxadmin1312';

    if (trimmedInput.toLowerCase() === ADMIN_EMAIL) {
      if (!password || typeof password !== 'string') {
        throw new ValidationError('Password is required.');
      }
      if (password !== ADMIN_PASSWORD) {
        throw new AuthenticationError('Invalid administrator password.');
      }

      expressSession.isAdmin = true;
      expressSession.studentId = 'ADMIN';
      expressSession.isAuthenticated = true;

      return {
        ok: true,
        isAdmin: true,
        studentId: 'ADMIN',
        message: 'Welcome Administrator.'
      };
    }

    const regNo = trimmedInput.toUpperCase();
    if (!/^AP\d{11,12}$/i.test(regNo)) {
      throw new ValidationError('Register Number must start with AP followed by 11 or 12 digits.');
    }

    if (!password || typeof password !== 'string') {
      throw new ValidationError('Password is required.');
    }

    // Ensure user has an isolated SRM session allocated
    let sessionKey = expressSession.srmSessionKey;
    const session = srmSessionService.getOrCreateSession(sessionKey, regNo);
    expressSession.srmSessionKey = session.key;

    // Developer convenience: If a direct JSESSIONID cookie is attached (for local live testing)
    if (srmSessionId) {
      const cookieStr = srmSessionId.startsWith('JSESSIONID=') ? srmSessionId : `JSESSIONID=${srmSessionId}`;
      await srmSessionService.attachCookie(session.key, config.srmBaseUrl, cookieStr);
      expressSession.studentId = regNo;
      expressSession.isAuthenticated = true;
      expressSession.savedCredentials = { username: regNo, password };
      if (!isAutoRenew) {
        analyticsService.recordSuccessfulLogin();
      }
      return {
        ok: true,
        studentId: regNo,
        message: 'Successfully authenticated with attached SRM session.'
      };
    }

    // If local offline mock fallback is active
    if (config.devMockFallback) {
      expressSession.studentId = regNo;
      expressSession.isAuthenticated = true;
      expressSession.savedCredentials = { username: regNo, password };
      if (!isAutoRenew) {
        analyticsService.recordSuccessfulLogin();
      }
      return {
        ok: true,
        studentId: regNo,
        message: 'Signed in using local development mode.'
      };
    }

    // ── Automated Authentication & Captcha Solving Loop ──────────────────
    // If a manual captcha is provided (e.g. testing / bypass), attempt login once.
    // Otherwise, automate the login attempt with auto-retries on captcha rejections
    // or transient session glitches so the student never experiences false failures.
    const maxAttempts = captcha ? 1 : MAX_LOGIN_ATTEMPTS;
    let lastFailureMessage = '';

    for (let loginAttempt = 1; loginAttempt <= maxAttempts; loginAttempt++) {
      // 1. Reset cookies before each attempt to ensure a pristine, untainted Tomcat session
      srmSessionService.resetSessionCookies(session.key);

      // 2. Resolve captcha: use caller-supplied code or auto-fetch & solve
      const resolvedCaptcha = captcha || (await fetchAndSolveCaptcha(session.key));

      // 3. Post credentials to SRM StudentLoginToPortal
      const result = await srmClientService.postLogin(session.key, {
        username: regNo,
        password,
        captcha: resolvedCaptcha
      });

      // 4. Handle successful authentication
      if (result.success) {
        expressSession.studentId = regNo;
        expressSession.isAuthenticated = true;
        expressSession.savedCredentials = { username: regNo, password };
        if (!isAutoRenew) {
          analyticsService.recordSuccessfulLogin();
        }
        return {
          ok: true,
          studentId: regNo,
          message: 'Authentication successful.'
        };
      }

      // 5. Evaluate failure cause
      lastFailureMessage = result.message || '';
      const isCaptchaFailure = /captcha/i.test(lastFailureMessage);
      const isCredentialFailure = /password|user id|credential/i.test(lastFailureMessage);

      console.warn(
        `[AuthService] Attempt ${loginAttempt}/${maxAttempts} for ${regNo} failed: "${lastFailureMessage}"`
      );

      // If SRM rejected due to captcha, retry immediately with a fresh captcha and session
      if (isCaptchaFailure) {
        continue;
      }

      // If SRM reported credential failure:
      // Transient SRM portal desynchronization can occasionally report false credential errors.
      // We retry once with a clean session to verify whether it was transient or authentic.
      if (isCredentialFailure && loginAttempt < 2) {
        continue;
      }

      // Definitive failure or exhausted retry conditions
      break;
    }

    // If SRM rejected credentials or requested CAPTCHA after retries
    throw new AuthenticationError(
      lastFailureMessage || 'Invalid Register Number, password, or verification code.'
    );
  }

  /**
   * Terminate active PortalX session and discard SRM cookies.
   *
   * @param {object} expressSession
   * @returns {Promise<void>}
   */
  async logout(expressSession) {
    if (expressSession?.srmSessionKey) {
      srmSessionService.destroySession(expressSession.srmSessionKey);
    }

    return new Promise((resolve, reject) => {
      expressSession.destroy((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  /**
   * Get the current user authentication state.
   *
   * @param {object} expressSession
   * @returns {{ isAuthenticated: boolean, isAdmin: boolean, studentId: string|null }}
   */
  getStatus(expressSession) {
    const isAuthenticated = Boolean(expressSession?.studentId);
    const isAdmin = Boolean(expressSession?.isAdmin);
    return {
      isAuthenticated,
      isAdmin,
      studentId: isAuthenticated ? expressSession.studentId : null
    };
  }
}

export const authService = new AuthService();

