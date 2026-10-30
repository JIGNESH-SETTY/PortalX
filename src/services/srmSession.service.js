import { CookieJar } from 'tough-cookie';
import crypto from 'node:crypto';

/**
 * In-memory registry for user-isolated SRM sessions.
 * Maps PortalX session keys to individual tough-cookie CookieJar instances.
 *
 * NOTE: For local development and single-instance deployments, this in-memory
 * map guarantees complete isolation between users without cross-talk.
 * In a multi-instance production environment, an external session store
 * (e.g., Redis) or encrypted session serialization would be used.
 */
class SrmSessionService {
  constructor() {
    this.sessions = new Map();

    // Periodically sweep sessions inactive for more than 2 hours
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, session] of this.sessions.entries()) {
        if (now - session.lastAccessedAt > TWO_HOURS_MS) {
          this.sessions.delete(key);
        }
      }
    }, 15 * 60 * 1000);

    // Ensure timer does not prevent process exit in tests
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Create or retrieve an isolated SRM session for a user.
   *
   * @param {string} [existingKey] - Existing session key from Express session
   * @param {string} [studentId] - Registered student ID
   * @returns {{ key: string, jar: CookieJar, studentId: string }}
   */
  getOrCreateSession(existingKey, studentId = null) {
    if (existingKey && this.sessions.has(existingKey)) {
      const session = this.sessions.get(existingKey);
      session.lastAccessedAt = Date.now();
      if (studentId && !session.studentId) {
        session.studentId = studentId;
      }
      return session;
    }

    const key = existingKey || crypto.randomUUID();
    const session = {
      key,
      jar: new CookieJar(),
      studentId: studentId || null,
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    };

    this.sessions.set(key, session);
    return session;
  }

  /**
   * Get an existing session by key.
   *
   * @param {string} key
   * @returns {{ key: string, jar: CookieJar, studentId: string } | null}
   */
  getSession(key) {
    if (!key || !this.sessions.has(key)) {
      return null;
    }
    const session = this.sessions.get(key);
    session.lastAccessedAt = Date.now();
    return session;
  }

  /**
   * Attach an existing SRM cookie string (e.g. JSESSIONID) to an isolated session jar.
   * Useful for testing with an active authenticated SRM browser session.
   *
   * @param {string} key
   * @param {string} srmBaseUrl
   * @param {string} cookieHeader
   */
  async attachCookie(key, srmBaseUrl, cookieHeader) {
    const session = this.getOrCreateSession(key);
    if (!cookieHeader) return session;

    const cookies = cookieHeader.split(';').map(c => c.trim()).filter(Boolean);
    for (const cookieStr of cookies) {
      try {
        await session.jar.setCookie(cookieStr, srmBaseUrl);
      } catch (err) {
        // Silently skip malformed individual cookie strings
      }
    }
    return session;
  }

  /**
   * Destroy an isolated SRM session and discard its cookies.
   *
   * @param {string} key
   */
  destroySession(key) {
    if (key && this.sessions.has(key)) {
      this.sessions.delete(key);
    }
  }
}

export const srmSessionService = new SrmSessionService();

