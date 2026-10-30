import { srmClientService } from './srmClient.service.js';
import { parseTimetableHtml } from '../parsers/timetable.parser.js';
import { config } from '../config/env.js';
import { MOCK_TIMETABLE } from './mockData.js';

class TimetableService {
  /**
   * Fetch and parse the student's weekly timetable and subject list.
   *
   * @param {string} srmSessionKey
   * @returns {Promise<{ days: object, subjects: Array, periods: Array }>}
   */
  async getTimetable(srmSessionKey) {
    if (config.devMockFallback) {
      return MOCK_TIMETABLE;
    }

    const html = await srmClientService.postReport(srmSessionKey, 10);
    return parseTimetableHtml(html);
  }
}

export const timetableService = new TimetableService();

