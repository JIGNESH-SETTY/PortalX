import { srmClientService } from './srmClient.service.js';
import { srmSessionService, MAX_FRIENDS } from './srmSession.service.js';
import { parseMarkAttendanceHtml } from '../parsers/markAttendance.parser.js';
import { analyticsService } from './analytics.service.js';
import { ValidationError } from '../utils/errors.js';
import { config } from '../config/env.js';

/**
 * Pacing delay between sequential friend attendance submissions in milliseconds.
 * Simulates human user timing to bypass university firewall rate limits.
 */
export const SUBMISSION_DELAY_MS = 20;

/**
 * Rate-limit bypass helper: Staggers sequential attendance submissions across multiple sessions.
 * Inserts a 20ms pause between submissions to simulate realistic human pacing and avoid
 * triggering SRM security firewalls or request burst throttles.
 *
 * @param {Array<{ key: string, studentId: string, isPrimary: boolean }>} targetSessions - List of sessions to submit
 * @param {string} cleanCode - Validated 7-character attendance code
 * @param {object} tokens - Optional dynamic location tokens { dynamiclatdata, dynamiclonxdata }
 * @param {Function} submitSingleFn - Function used to submit for an individual session
 * @returns {Promise<Array<{ studentId: string, isPrimary: boolean, ok: boolean, message: string, resultstatus?: string }>>}
 */
async function submitAttendanceWithDelay(targetSessions, cleanCode, tokens, submitSingleFn) {
  const submissionResults = [];

  for (let i = 0; i < targetSessions.length; i++) {
    const session = targetSessions[i];

    // Introduce delay between requests (skipping delay before the very first request)
    if (i > 0) {
      // Simulate human behavior and prevent parallel burst firewall blocks on SRM gateway
      await new Promise(resolve => setTimeout(resolve, SUBMISSION_DELAY_MS));
    }

    try {
      const result = await submitSingleFn(session.key, session.studentId, {
        code: cleanCode,
        dynamiclatdata: tokens?.dynamiclatdata,
        dynamiclonxdata: tokens?.dynamiclonxdata
      });

      submissionResults.push({
        studentId: session.studentId,
        isPrimary: session.isPrimary,
        ok: result.ok,
        resultstatus: result.resultstatus,
        message: result.message
      });
    } catch (error) {
      submissionResults.push({
        studentId: session.studentId,
        isPrimary: session.isPrimary,
        ok: false,
        message: error.message || 'Submission failed for this account.'
      });
    }
  }

  return submissionResults;
}

class MarkAttendanceService {
  /**
   * Fetch current attendance page details (day order, today's entries, dynamic lat/lon).
   *
   * @param {string} srmSessionKey
   * @param {string} studentId
   * @returns {Promise<object>}
   */
  async getPageData(srmSessionKey, studentId) {
    if (config.devMockFallback) {
      return {
        dayOrder: 'Day 3',
        todayAttendance: [],
        onlineAttendance: [],
        dynamiclatdata: '',
        dynamiclonxdata: '',
        codeLength: 7
      };
    }

    const html = await srmClientService.getAttendancePage(srmSessionKey, studentId);
    return parseMarkAttendanceHtml(html);
  }

  /**
   * Submit student's 7-character attendance code to SRM.
   *
   * @param {string} srmSessionKey
   * @param {string} studentId
   * @param {object} params
   * @param {string} params.code - 7-character alphanumeric code (e.g. A123456)
   * @param {string} [params.dynamiclatdata]
   * @param {string} [params.dynamiclonxdata]
   * @returns {Promise<object>}
   */
  async submitCode(srmSessionKey, studentId, { code, dynamiclatdata, dynamiclonxdata }) {
    if (!code || typeof code !== 'string') {
      throw new ValidationError('Attendance code is required.');
    }

    const cleanCode = code.trim().toUpperCase();
    if (!/^[A-Z]\d{6}$/.test(cleanCode)) {
      throw new ValidationError('Attendance code must be 1 letter followed by 6 digits (e.g. A123456).');
    }

    if (config.devMockFallback) {
      return {
        ok: true,
        mock: true,
        resultstatus: '1',
        result: 'Preview mode: mock attendance code accepted.',
        message: 'Preview mode: mock attendance code accepted.'
      };
    }

    // If dynamic tokens were not provided by the frontend, fetch the page to extract current tokens
    let lat = dynamiclatdata;
    let lon = dynamiclonxdata;
    if (!lat || !lon) {
      try {
        const pageData = await this.getPageData(srmSessionKey, studentId);
        lat = lat || pageData.dynamiclatdata;
        lon = lon || pageData.dynamiclonxdata;
      } catch {
        // Fall back gracefully with empty strings if page fetch fails
      }
    }

    const srmResponse = await srmClientService.submitAttendanceCode(srmSessionKey, {
      acode: cleanCode,
      dynamiclatdata: lat || '',
      dynamiclonxdata: lon || ''
    });

    // Check SRM result status:
    // Some endpoints use resultstatus "1" for success, others return "0" with a message.
    // Preserve the exact server-provided message.
    const isRecorded =
      srmResponse.resultstatus === '1' ||
      (typeof srmResponse.result === 'string' &&
        (srmResponse.result.toLowerCase().includes('success') ||
          srmResponse.result.toLowerCase().includes('marked')));

    if (isRecorded) {
      analyticsService.recordAttendanceMarked(1, cleanCode);
    }

    return {
      ok: isRecorded,
      resultstatus: srmResponse.resultstatus,
      result: srmResponse.result || 'No server message provided.',
      message: srmResponse.result || (isRecorded ? 'Attendance marked successfully.' : 'Attendance code not accepted.')
    };
  }

  /**
   * Submit attendance code in batch for the primary user and all active friend sessions.
   *
   * @param {string} primarySessionKey - The primary student's SRM session key
   * @param {string} primaryStudentId - The primary student's Register Number
   * @param {object} params
   * @param {string} params.code - 7-character attendance code
   * @param {string} [params.dynamiclatdata]
   * @param {string} [params.dynamiclonxdata]
   * @returns {Promise<{ ok: boolean, results: Array<object>, message: string }>}
   */
  async submitGroupCode(primarySessionKey, primaryStudentId, { code, dynamiclatdata, dynamiclonxdata }) {
    if (!code || typeof code !== 'string') {
      throw new ValidationError('Attendance code is required.');
    }

    const cleanCode = code.trim().toUpperCase();
    if (!/^[A-Z]\d{6}$/.test(cleanCode)) {
      throw new ValidationError('Attendance code must be 1 letter followed by 6 digits (e.g. A123456).');
    }

    // Retrieve active friend sessions registered under this primary session
    const friendSessions = srmSessionService.getFriendSessions(primarySessionKey);

    // Build the consolidated list of all accounts (primary user first, followed by up to 4 friends)
    const targetSessions = [
      { key: primarySessionKey, studentId: primaryStudentId, isPrimary: true },
      ...friendSessions.map(friend => ({ key: friend.key, studentId: friend.studentId, isPrimary: false }))
    ];

    // Handle offline dev mock fallback
    if (config.devMockFallback) {
      const mockResults = targetSessions.map(session => ({
        studentId: session.studentId,
        isPrimary: session.isPrimary,
        ok: true,
        message: 'Preview mode: mock attendance code accepted.'
      }));

      return {
        ok: true,
        results: mockResults,
        message: `Group attendance marked for ${mockResults.length} account(s).`
      };
    }

    // Execute staggered submissions with delay to avoid SRM firewall rate limits
    const results = await submitAttendanceWithDelay(
      targetSessions,
      cleanCode,
      { dynamiclatdata, dynamiclonxdata },
      (sessionKey, studentId, payload) => this.submitCode(sessionKey, studentId, payload)
    );

    const successCount = results.filter(r => r.ok).length;
    const allOk = successCount === results.length;

    return {
      ok: allOk,
      results,
      message: `Group attendance processed: ${successCount} of ${results.length} succeeded.`
    };
  }
}

export const markAttendanceService = new MarkAttendanceService();

