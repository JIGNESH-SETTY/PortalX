import { srmClientService } from './srmClient.service.js';
import { parseMarkAttendanceHtml } from '../parsers/markAttendance.parser.js';
import { ValidationError } from '../utils/errors.js';
import { config } from '../config/env.js';

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

    return {
      ok: isRecorded,
      resultstatus: srmResponse.resultstatus,
      result: srmResponse.result || 'No server message provided.',
      message: srmResponse.result || (isRecorded ? 'Attendance marked successfully.' : 'Attendance code not accepted.')
    };
  }
}

export const markAttendanceService = new MarkAttendanceService();

