import { CookieJar } from 'tough-cookie';
import crypto from 'node:crypto';
import { ValidationError } from '../utils/errors.js';

/**
 * Maximum number of friend sessions a primary user can attach for group attendance.
 * Defined as a named constant to avoid magic numbers.
 */
export const MAX_FRIENDS = 4;

/**
 * In-memory registry for user-isolated SRM sessions.
 * Maps PortalX session keys to individual tough-cookie CookieJar instances.
 * Also manages secondary/friend sessions grouped under the primary student's session.
 *
 * NOTE: For local development and single-instance deployments, this in-memory
 * map guarantees complete isolation between users without cross-talk.
 * In a multi-instance production environment, an external session store
 * (e.g., Redis) or encrypted session serialization would be used.
 */
class SrmSessionService {
  constructor() {
    /**
     * Primary session registry: Maps sessionKey -> { key, jar, studentId, createdAt, lastAccessedAt }
     * @type {Map<string, object>}
     */
    this.sessions = new Map();

    /**
     * Friend session pool: Maps primarySessionKey -> Array<{ key: string, studentId: string, addedAt: number }>
     * Allows a primary student to maintain active SRM authentication for up to 4 friends.
     * @type {Map<string, Array<{ key: string, studentId: string, addedAt: number }>>}
     */
    this.friendSessions = new Map();

    // Periodically sweep sessions inactive for more than 2 hours
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, session] of this.sessions.entries()) {
        if (now - session.lastAccessedAt > TWO_HOURS_MS) {
          this.destroySession(key);
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
   * Also purges any friend sessions associated with this primary session.
   *
   * @param {string} key - Primary or individual session key to destroy
   * @returns {void}
   */
  destroySession(key) {
    if (!key) return;

    // Purge associated friend sessions if this was a primary session
    if (this.friendSessions.has(key)) {
      const friends = this.friendSessions.get(key) || [];
      for (const friend of friends) {
        if (friend.key && this.sessions.has(friend.key)) {
          this.sessions.delete(friend.key);
        }
      }
      this.friendSessions.delete(key);
    }

    // Delete the primary session itself
    if (this.sessions.has(key)) {
      this.sessions.delete(key);
    }
  }

  /**
   * Retrieve all friend sessions linked to a primary student's session.
   *
   * @param {string} primarySessionKey - The primary user's PortalX SRM session key
   * @returns {Array<{ key: string, studentId: string, addedAt: number }>} Array of active friend sessions
   */
  getFriendSessions(primarySessionKey) {
    if (!primarySessionKey || !this.friendSessions.has(primarySessionKey)) {
      return [];
    }
    return this.friendSessions.get(primarySessionKey) || [];
  }

  /**
   * Store a secondary friend session linked to the primary student's session.
   * Enforces MAX_FRIENDS = 4 limit and prevents duplicates.
   *
   * @param {string} primarySessionKey - The primary user's PortalX SRM session key
   * @param {object} friendData
   * @param {string} friendData.key - The friend's isolated SRM session key
   * @param {string} friendData.studentId - The friend's Register Number (e.g., AP25110010808)
   * @returns {Array<{ key: string, studentId: string, addedAt: number }>} Updated list of friend sessions
   * @throws {ValidationError} When maximum limit of 4 friends is reached or friend is already present
   */
  addFriendSession(primarySessionKey, { key, studentId }) {
    if (!primarySessionKey) {
      throw new ValidationError('Primary session key is required to register a friend.');
    }
    if (!key || !studentId) {
      throw new ValidationError('Friend session key and Register Number are required.');
    }

    const currentFriends = this.getFriendSessions(primarySessionKey);

    // Prevent duplicate entries for the same student ID
    const normalizedRegId = studentId.trim().toUpperCase();
    const isDuplicate = currentFriends.some(
      friend => friend.studentId.toUpperCase() === normalizedRegId
    );
    if (isDuplicate) {
      throw new ValidationError(`Student ${normalizedRegId} is already in your attendance group.`);
    }

    // Enforce the maximum friend limit of 4
    if (currentFriends.length >= MAX_FRIENDS) {
      throw new ValidationError(`Maximum limit of ${MAX_FRIENDS} friends reached for group attendance.`);
    }

    const newFriendEntry = {
      key,
      studentId: normalizedRegId,
      addedAt: Date.now()
    };

    const updatedFriends = [...currentFriends, newFriendEntry];
    this.friendSessions.set(primarySessionKey, updatedFriends);

    return updatedFriends;
  }

  /**
   * Remove a single friend session from the primary student's group pool.
   *
   * @param {string} primarySessionKey - The primary user's PortalX SRM session key
   * @param {string} friendStudentId - The friend's Register Number to remove
   * @returns {boolean} True if a friend was removed, false otherwise
   */
  removeFriendSession(primarySessionKey, friendStudentId) {
    if (!primarySessionKey || !friendStudentId || !this.friendSessions.has(primarySessionKey)) {
      return false;
    }

    const normalizedRegId = friendStudentId.trim().toUpperCase();
    const currentFriends = this.friendSessions.get(primarySessionKey) || [];
    const targetFriend = currentFriends.find(f => f.studentId.toUpperCase() === normalizedRegId);

    if (targetFriend) {
      // Discard the friend's session from main registry
      if (this.sessions.has(targetFriend.key)) {
        this.sessions.delete(targetFriend.key);
      }
      const remainingFriends = currentFriends.filter(f => f.studentId.toUpperCase() !== normalizedRegId);
      this.friendSessions.set(primarySessionKey, remainingFriends);
      return true;
    }

    return false;
  }

  /**
   * Clear all friend sessions for a primary user.
   *
   * @param {string} primarySessionKey - The primary user's PortalX SRM session key
   * @returns {void}
   */
  clearFriendSessions(primarySessionKey) {
    if (primarySessionKey && this.friendSessions.has(primarySessionKey)) {
      const friends = this.friendSessions.get(primarySessionKey) || [];
      for (const friend of friends) {
        if (friend.key && this.sessions.has(friend.key)) {
          this.sessions.delete(friend.key);
        }
      }
      this.friendSessions.delete(primarySessionKey);
    }
  }
}

export const srmSessionService = new SrmSessionService();

