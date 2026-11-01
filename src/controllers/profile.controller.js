import { profileService } from '../services/profile.service.js';
import { withSrmAutoRenew } from '../utils/srmAutoRenew.js';

export const profileController = {
  /**
   * Return authenticated student's profile with transparent auto-renewal.
   */
  async getProfile(req, res) {
    const profile = await withSrmAutoRenew(req, async () => {
      const srmSessionKey = req.session?.srmSessionKey;
      const studentId = req.session?.studentId;
      return await profileService.getStudentProfile(srmSessionKey, studentId);
    });

    res.status(200).json({
      ok: true,
      data: profile,
      message: null
    });
  }
};

