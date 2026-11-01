import { timetableService } from '../services/timetable.service.js';
import { withSrmAutoRenew } from '../utils/srmAutoRenew.js';

export const timetableController = {
  /**
   * Return student's weekly timetable and subject list with transparent auto-renewal.
   */
  async getTimetable(req, res) {
    const timetable = await withSrmAutoRenew(req, async () => {
      const srmSessionKey = req.session?.srmSessionKey;
      return await timetableService.getTimetable(srmSessionKey);
    });

    res.status(200).json({
      ok: true,
      data: timetable,
      message: null
    });
  }
};

