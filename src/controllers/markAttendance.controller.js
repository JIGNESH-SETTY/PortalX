import { markAttendanceService } from '../services/markAttendance.service.js';

export const markAttendanceController = {
  /**
   * Return Mark Attendance page information (day order, today's attendance history).
   */
  async getPageData(req, res) {
    const srmSessionKey = req.session?.srmSessionKey;
    const studentId = req.session?.studentId;

    const data = await markAttendanceService.getPageData(srmSessionKey, studentId);

    res.status(200).json({
      ok: true,
      data,
      message: null
    });
  },

  /**
   * Submit an attendance code for the current class.
   */
  async submitAttendance(req, res) {
    const srmSessionKey = req.session?.srmSessionKey;
    const studentId = req.session?.studentId;
    const { code, dynamiclatdata, dynamiclonxdata } = req.body || {};

    const result = await markAttendanceService.submitCode(srmSessionKey, studentId, {
      code,
      dynamiclatdata,
      dynamiclonxdata
    });

    res.status(200).json({
      ok: result.ok,
      data: result,
      message: result.message
    });
  }
};

