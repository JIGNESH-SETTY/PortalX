import { timetableService } from '../services/timetable.service.js';

export const timetableController = {
  /**
   * Return student's weekly timetable and subject list.
   */
  async getTimetable(req, res) {
    const srmSessionKey = req.session?.srmSessionKey;
    const timetable = await timetableService.getTimetable(srmSessionKey);

    res.status(200).json({
      ok: true,
      data: timetable,
      message: null
    });
  }
};

