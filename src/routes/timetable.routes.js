import { Router } from 'express';
import { timetableController } from '../controllers/timetable.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(timetableController.getTimetable));

export default router;

