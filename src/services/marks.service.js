import { srmClientService } from './srmClient.service.js';
import { parseMarksHtml } from '../parsers/marks.parser.js';
import { config } from '../config/env.js';
import { MOCK_MARKS } from './mockData.js';

class MarksService {
  /**
   * Fetch and parse internal marks summary and component-wise assessments.
   *
   * @param {string} srmSessionKey
   * @returns {Promise<{ rows: Array, subjects: Array }>}
   */
  async getInternalMarks(srmSessionKey) {
    if (config.devMockFallback) {
      return MOCK_MARKS;
    }

    const html = await srmClientService.postReport(srmSessionKey, 5);
    return parseMarksHtml(html);
  }
}

export const marksService = new MarksService();

