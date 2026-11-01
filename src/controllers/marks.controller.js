import { marksService } from '../services/marks.service.js';
import { withSrmAutoRenew } from '../utils/srmAutoRenew.js';

export const marksController = {
  /**
   * Return internal marks summary and component breakdowns with transparent auto-renewal.
   */
  async getMarks(req, res) {
    const marks = await withSrmAutoRenew(req, async () => {
      const srmSessionKey = req.session?.srmSessionKey;
      return await marksService.getInternalMarks(srmSessionKey);
    });

    res.status(200).json({
      ok: true,
      data: marks,
      message: null
    });
  }
};

