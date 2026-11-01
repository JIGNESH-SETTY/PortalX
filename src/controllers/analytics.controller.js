import { analyticsService } from '../services/analytics.service.js';

export const analyticsController = {
  /**
   * Ingest client-side analytics events (page views, clicks).
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async track(req, res) {
    const { type, page, count } = req.body || {};
    const clientIdentifier = req.sessionID || req.ip;

    if (type === 'pageview') {
      analyticsService.recordPageView(page || 'home', clientIdentifier);
    } else if (type === 'click') {
      analyticsService.recordClicks(count || 1);
    } else {
      // General ping / viewer registration
      analyticsService.recordViewer(clientIdentifier);
    }

    res.status(200).json({ ok: true });
  },

  /**
   * Retrieve aggregate analytics dashboard data for administrator.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getStats(req, res) {
    const stats = analyticsService.getStats();
    res.status(200).json({
      ok: true,
      data: stats,
      message: null
    });
  }
};
