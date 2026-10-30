import { authService } from '../services/auth.service.js';

export const authController = {
  /**
   * Handle student login.
   */
  async login(req, res) {
    const { username, password, captcha, srmSessionId } = req.body || {};
    const result = await authService.login({
      username,
      password,
      captcha,
      srmSessionId,
      expressSession: req.session
    });

    // Explicitly persist session before sending response to eliminate race conditions
    // with parallel immediate fetches (Profile, Timetable, Attendance, Marks)
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    res.status(200).json({
      ok: true,
      data: {
        studentId: result.studentId,
        token: req.sessionID
      },
      message: result.message
    });
  },

  /**
   * Handle student logout.
   */
  async logout(req, res) {
    await authService.logout(req.session);
    res.status(200).json({
      ok: true,
      data: null,
      message: 'Logged out successfully.'
    });
  },

  /**
   * Get current authentication status.
   */
  async getStatus(req, res) {
    const status = authService.getStatus(req.session);
    res.status(200).json({
      ok: true,
      data: status,
      message: null
    });
  }
};

