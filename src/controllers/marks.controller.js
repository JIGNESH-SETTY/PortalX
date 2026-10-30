import { marksService } from '../services/marks.service.js';

export const marksController = {
  /**
   * Return internal marks summary and component breakdowns.
   */
  async getMarks(req, res) {
    const srmSessionKey = req.session?.srmSessionKey;
    const marks = await marksService.getInternalMarks(srmSessionKey);

    res.status(200).json({
      ok: true,
      data: marks,
      message: null
    });
  }
};

