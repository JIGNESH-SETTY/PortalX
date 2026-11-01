import { markAttendanceService } from '../services/markAttendance.service.js';
import { srmSessionService, MAX_FRIENDS } from '../services/srmSession.service.js';
import { authService } from '../services/auth.service.js';
import { ValidationError } from '../utils/errors.js';
import { withSrmAutoRenew } from '../utils/srmAutoRenew.js';

export const markAttendanceController = {
  /**
   * Return Mark Attendance page information (day order, today's attendance history) with auto-renewal.
   *
   * @param {import('express').Request} req - Express request
   * @param {import('express').Response} res - Express response
   */
  async getPageData(req, res) {
    const data = await withSrmAutoRenew(req, async () => {
      const srmSessionKey = req.session?.srmSessionKey;
      const studentId = req.session?.studentId;
      return await markAttendanceService.getPageData(srmSessionKey, studentId);
    });

    res.status(200).json({
      ok: true,
      data,
      message: null
    });
  },

  /**
   * Submit an attendance code for the current class (single student).
   *
   * @param {import('express').Request} req - Express request
   * @param {import('express').Response} res - Express response
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
  },

  /**
   * Authenticate a friend's credentials and register their SRM session
   * under the primary user's group attendance pool.
   *
   * @param {import('express').Request} req - Express request
   * @param {import('express').Response} res - Express response
   */
  async addFriend(req, res) {
    const primarySessionKey = req.session?.srmSessionKey;
    const primaryStudentId = req.session?.studentId;
    const { username, regId, friendRegId, password } = req.body || {};

    // Support flexible naming (username, regId, or friendRegId)
    const targetRegId = (username || regId || friendRegId || '').trim().toUpperCase();

    if (!targetRegId) {
      throw new ValidationError('Friend Register Number is required.');
    }

    if (!/^AP\d{11,12}$/i.test(targetRegId)) {
      throw new ValidationError('Friend Register Number must start with AP followed by 11 or 12 digits.');
    }

    if (!password || typeof password !== 'string') {
      throw new ValidationError('Friend password is required.');
    }

    // Prevent primary student from adding their own account as a friend
    if (primaryStudentId && targetRegId === primaryStudentId.toUpperCase()) {
      throw new ValidationError('You cannot add your own primary account to your friends group.');
    }

    // Enforce friend pool limits before executing network authentication
    const activeFriends = srmSessionService.getFriendSessions(primarySessionKey);
    if (activeFriends.length >= MAX_FRIENDS) {
      throw new ValidationError(`Maximum limit of ${MAX_FRIENDS} friends reached for group attendance.`);
    }

    if (activeFriends.some(friend => friend.studentId.toUpperCase() === targetRegId)) {
      throw new ValidationError(`Friend ${targetRegId} is already in your attendance group.`);
    }

    // Authenticate the friend against SRM using an isolated session container
    // so the primary student's expressSession remains unaffected
    const friendSessionContainer = { srmSessionKey: null };
    const authResult = await authService.login({
      username: targetRegId,
      password,
      expressSession: friendSessionContainer
    });

    // Save friend's authenticated session into the primary user's group pool
    srmSessionService.addFriendSession(primarySessionKey, {
      key: friendSessionContainer.srmSessionKey,
      studentId: authResult.studentId
    });

    res.status(200).json({
      success: true,
      ok: true,
      regId: authResult.studentId,
      message: `Friend ${authResult.studentId} successfully verified and added to group.`
    });
  },

  /**
   * Retrieve the list of active friends registered for the primary student's session.
   *
   * @param {import('express').Request} req - Express request
   * @param {import('express').Response} res - Express response
   */
  async getFriends(req, res) {
    const primarySessionKey = req.session?.srmSessionKey;
    const friends = srmSessionService.getFriendSessions(primarySessionKey);

    res.status(200).json({
      ok: true,
      data: friends.map(friend => ({
        studentId: friend.studentId,
        addedAt: friend.addedAt
      })),
      message: null
    });
  },

  /**
   * Remove a friend from the primary student's group attendance pool.
   *
   * @param {import('express').Request} req - Express request
   * @param {import('express').Response} res - Express response
   */
  async removeFriend(req, res) {
    const primarySessionKey = req.session?.srmSessionKey;
    const { studentId, regId, friendRegId } = req.body || {};
    const targetRegId = (studentId || regId || friendRegId || '').trim().toUpperCase();

    if (!targetRegId) {
      throw new ValidationError('Register Number of the friend to remove is required.');
    }

    const wasRemoved = srmSessionService.removeFriendSession(primarySessionKey, targetRegId);

    res.status(200).json({
      ok: wasRemoved,
      data: { studentId: targetRegId, removed: wasRemoved },
      message: wasRemoved ? `Friend ${targetRegId} removed from group.` : `Friend ${targetRegId} was not found in group.`
    });
  },

  /**
   * Batch submit an attendance code for the primary user and all active friends.
   *
   * @param {import('express').Request} req - Express request
   * @param {import('express').Response} res - Express response
   */
  async submitGroupAttendance(req, res) {
    const primarySessionKey = req.session?.srmSessionKey;
    const primaryStudentId = req.session?.studentId;
    const { code, dynamiclatdata, dynamiclonxdata } = req.body || {};

    const groupResult = await markAttendanceService.submitGroupCode(primarySessionKey, primaryStudentId, {
      code,
      dynamiclatdata,
      dynamiclonxdata
    });

    res.status(200).json({
      ok: groupResult.ok,
      data: groupResult.results,
      message: groupResult.message
    });
  }
};

