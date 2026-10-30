import { Router } from 'express';
import { marksController } from '../controllers/marks.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(marksController.getMarks));

export default router;

