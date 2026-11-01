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

    if (type === 'pageview') {
      analyticsService.recordPageView(page || 'home');
    } else if (type === 'click') {
      analyticsService.recordClicks(count || 1);
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
  },

  /**
   * Reset all analytics counters to zero (restricted to administrator).
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async reset(req, res) {
    const stats = analyticsService.resetStats();
    res.status(200).json({
      ok: true,
      data: stats,
      message: 'All analytics counters have been reset to 0.'
    });
  }
};
