import { attendanceService } from '../services/attendance.service.js';

export const attendanceController = {
  /**
   * Return subject-wise attendance records and date range.
   */
  async getAttendance(req, res) {
    const srmSessionKey = req.session?.srmSessionKey;
    const attendance = await attendanceService.getAttendanceRecords(srmSessionKey);

    res.status(200).json({
      ok: true,
      data: attendance,
      message: null
    });
  }
};

