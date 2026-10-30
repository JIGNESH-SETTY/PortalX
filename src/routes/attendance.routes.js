import { Router } from 'express';
import { attendanceController } from '../controllers/attendance.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(attendanceController.getAttendance));

export default router;

