import { Router } from 'express';
import { markAttendanceController } from '../controllers/markAttendance.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(markAttendanceController.getPageData));
router.post('/submit', requireAuth, asyncHandler(markAttendanceController.submitAttendance));

export default router;

