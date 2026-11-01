import { Router } from 'express';
import { markAttendanceController } from '../controllers/markAttendance.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Page information and today's attendance history
router.get('/', requireAuth, asyncHandler(markAttendanceController.getPageData));

// Individual attendance submission
router.post('/submit', requireAuth, asyncHandler(markAttendanceController.submitAttendance));

// Group Attendance Endpoints
router.get('/friends', requireAuth, asyncHandler(markAttendanceController.getFriends));
router.post('/add-friend', requireAuth, asyncHandler(markAttendanceController.addFriend));
router.post('/remove-friend', requireAuth, asyncHandler(markAttendanceController.removeFriend));
router.post('/submit-group', requireAuth, asyncHandler(markAttendanceController.submitGroupAttendance));

export default router;

