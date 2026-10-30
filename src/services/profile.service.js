import { srmClientService } from './srmClient.service.js';
import { parseProfileHtml } from '../parsers/profile.parser.js';
import { config } from '../config/env.js';
import { MOCK_PROFILE } from './mockData.js';

class ProfileService {
  /**
   * Fetch and parse the authenticated student's profile.
   *
   * @param {string} srmSessionKey
   * @param {string} [studentId]
   * @returns {Promise<object>}
   */
  async getStudentProfile(srmSessionKey, studentId = null) {
    if (config.devMockFallback) {
      return {
        ...MOCK_PROFILE,
        studentId: studentId || MOCK_PROFILE.studentId,
        regNo: studentId || MOCK_PROFILE.regNo
      };
    }

    const html = await srmClientService.postReport(srmSessionKey, 1);
    const profile = parseProfileHtml(html);

    if (studentId && !profile.studentId) {
      profile.studentId = studentId;
      profile.regNo = studentId;
    }

    return profile;
  }
}

export const profileService = new ProfileService();

