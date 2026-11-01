import { attendanceService } from '../services/attendance.service.js';
import { withSrmAutoRenew } from '../utils/srmAutoRenew.js';

export const attendanceController = {
  /**
   * Return subject-wise attendance records and date range with transparent auto-renewal.
   */
  async getAttendance(req, res) {
    const attendance = await withSrmAutoRenew(req, async () => {
      const srmSessionKey = req.session?.srmSessionKey;
      return await attendanceService.getAttendanceRecords(srmSessionKey);
    });

    res.status(200).json({
      ok: true,
      data: attendance,
      message: null
    });
  }
};

