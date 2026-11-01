import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller.js';
import { requireAdmin } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Ingest analytics event (page views, clicks)
router.post('/track', asyncHandler(analyticsController.track));

// Retrieve full analytics data (restricted to administrator)
router.get('/stats', requireAdmin, asyncHandler(analyticsController.getStats));

export default router;
