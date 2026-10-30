import { srmClientService } from './srmClient.service.js';
import { parseAttendanceHtml } from '../parsers/attendance.parser.js';
import { config } from '../config/env.js';
import { MOCK_ATTENDANCE } from './mockData.js';

class AttendanceService {
  /**
   * Fetch and parse subject-wise attendance records and date range.
   *
   * @param {string} srmSessionKey
   * @returns {Promise<{ from: string, to: string, rows: Array, subjects: Array, summary: object }>}
   */
  async getAttendanceRecords(srmSessionKey) {
    if (config.devMockFallback) {
      return MOCK_ATTENDANCE;
    }

    const html = await srmClientService.postReport(srmSessionKey, 3);
    return parseAttendanceHtml(html);
  }
}

export const attendanceService = new AttendanceService();

