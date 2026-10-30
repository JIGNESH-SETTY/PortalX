import { srmSessionService } from './srmSession.service.js';
import { srmClientService } from './srmClient.service.js';
import { captchaService } from './captcha.service.js';
import { config } from '../config/env.js';
import { ValidationError, AuthenticationError } from '../utils/errors.js';

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
   * @returns {Promise<{ ok: boolean, studentId: string, message: string }>}
   */
  async login({ username, password, captcha, srmSessionId, expressSession }) {
    if (!username || typeof username !== 'string') {
      throw new ValidationError('Register Number is required.');
    }

    const regNo = username.trim().toUpperCase();
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
      return {
        ok: true,
        studentId: regNo,
        message: 'Signed in using local development mode.'
      };
    }

    // ── Auto-solve CAPTCHA ────────────────────────────────────────────────
    // If the caller did not manually supply a captcha code (which is the normal
    // case for the PortalX frontend), we automatically:
    //   1. Fetch the CAPTCHA image from SRM (seeding the session cookie).
    //   2. Run OCR via captchaService to predict the code.
    //   3. Validate the result is 4–5 alphanumeric chars (SRM's format).
    //   4. Retry up to MAX_CAPTCHA_ATTEMPTS times if the OCR output is unusable.
    //   5. Pass the best predicted code into the login POST.
    //
    // Each retry fetches a fresh captcha image (and a new JSESSIONID),
    // so the captcha and the session cookie used in postLogin always match.
    const MAX_CAPTCHA_ATTEMPTS = 5;
    let resolvedCaptcha = captcha || '';

    if (!resolvedCaptcha) {
      for (let attempt = 1; attempt <= MAX_CAPTCHA_ATTEMPTS; attempt++) {
        try {
          const captchaImageBuffer = await srmClientService.fetchCaptchaImage(session.key);
          const solved = await captchaService.solve(captchaImageBuffer);

          // SRM captchas are always 4–5 uppercase alphanumeric characters.
          // If OCR produced something outside this range, fetch a fresh one.
          if (solved.length >= 4 && solved.length <= 5) {
            resolvedCaptcha = solved;
            break;
          }

          console.warn(`[CaptchaService] Attempt ${attempt}/${MAX_CAPTCHA_ATTEMPTS}: OCR returned "${solved}" (${solved.length} chars) — retrying`);
        } catch (captchaErr) {
          console.warn(`[CaptchaService] Attempt ${attempt}/${MAX_CAPTCHA_ATTEMPTS}: ${captchaErr.message}`);
        }
      }

      if (!resolvedCaptcha) {
        console.warn('[CaptchaService] All attempts exhausted — proceeding without captcha');
      }
    }

    // Attempt live authentication against SRM
    const result = await srmClientService.postLogin(session.key, {
      username: regNo,
      password,
      captcha: resolvedCaptcha
    });

    if (result.success) {
      expressSession.studentId = regNo;
      expressSession.isAuthenticated = true;
      return {
        ok: true,
        studentId: regNo,
        message: 'Authentication successful.'
      };
    }

    // If SRM rejected credentials or requested CAPTCHA
    throw new AuthenticationError(
      result.message || 'Invalid Register Number, password, or verification code.'
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
   * @returns {{ isAuthenticated: boolean, studentId: string|null }}
   */
  getStatus(expressSession) {
    const isAuthenticated = Boolean(expressSession?.studentId);
    return {
      isAuthenticated,
      studentId: isAuthenticated ? expressSession.studentId : null
    };
  }
}

export const authService = new AuthService();

