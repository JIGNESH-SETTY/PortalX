import { profileService } from '../services/profile.service.js';

export const profileController = {
  /**
   * Return authenticated student's profile.
   */
  async getProfile(req, res) {
    const srmSessionKey = req.session?.srmSessionKey;
    const studentId = req.session?.studentId;

    const profile = await profileService.getStudentProfile(srmSessionKey, studentId);

    res.status(200).json({
      ok: true,
      data: profile,
      message: null
    });
  }
};

