import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');

/** Timezone used to evaluate midnight day changes (SRM University-AP is in IST) */
const TIMEZONE = 'Asia/Kolkata';

/**
 * Service to record and retrieve user interaction analytics.
 * Tracks total visitors (successful logins), visitors today (resets on day change),
 * user clicks, attendances marked, and per-page view statistics.
 * No unbounded activity logs are retained.
 */
class AnalyticsService {
  constructor() {
    /** In-memory telemetry state */
    this.data = {
      totalVisitors: 0,
      todayVisitors: 0,
      todayDate: this.getCurrentDateKey(),
      totalClicks: 0,
      totalAttendancesMarked: 0,
      totalPageViews: 0,
      pageViews: {
        home: 0,
        attendance: 0,
        timetable: 0,
        marks: 0,
        profile: 0,
        mark: 0
      }
    };

    this.saveTimeout = null;
    this.init();
  }

  /**
   * Get current date in YYYY-MM-DD format in SRM AP Indian Standard Time.
   *
   * @returns {string} e.g. "2026-11-01"
   */
  getCurrentDateKey() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }

  /**
   * Verify if the calendar day has changed. If midnight has passed,
   * reset the todayVisitors counter to zero while keeping totalVisitors intact.
   */
  checkAndResetDayRollover() {
    const currentDate = this.getCurrentDateKey();
    if (this.data.todayDate !== currentDate) {
      this.data.todayDate = currentDate;
      this.data.todayVisitors = 0;
      this.scheduleSave();
    }
  }

  /**
   * Initialize data directory and load existing counters from disk if available.
   */
  init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(ANALYTICS_FILE)) {
        const raw = fs.readFileSync(ANALYTICS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = {
          totalVisitors: Number(parsed.totalVisitors) || 0,
          todayVisitors: Number(parsed.todayVisitors) || 0,
          todayDate: parsed.todayDate || this.getCurrentDateKey(),
          totalClicks: Number(parsed.totalClicks) || 0,
          totalAttendancesMarked: Number(parsed.totalAttendancesMarked) || 0,
          totalPageViews: Number(parsed.totalPageViews) || 0,
          pageViews: {
            home: Number(parsed.pageViews?.home) || 0,
            attendance: Number(parsed.pageViews?.attendance) || 0,
            timetable: Number(parsed.pageViews?.timetable) || 0,
            marks: Number(parsed.pageViews?.marks) || 0,
            profile: Number(parsed.pageViews?.profile) || 0,
            mark: Number(parsed.pageViews?.mark) || 0
          }
        };
        // Verify day rollover on server startup
        this.checkAndResetDayRollover();
      } else {
        this.saveImmediately();
      }
    } catch (err) {
      console.warn('[AnalyticsService] Notice during storage initialization:', err.message);
    }
  }

  /**
   * Persist current in-memory counters to disk with debouncing.
   */
  scheduleSave() {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.saveImmediately();
    }, 1000);
  }

  /**
   * Write data synchronously to disk.
   */
  saveImmediately() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      // Graceful fallback for read-only environments
    }
  }

  /**
   * Record a successful student login.
   * Increments both totalVisitors (all-time) and todayVisitors (today count).
   */
  recordSuccessfulLogin() {
    this.checkAndResetDayRollover();
    this.data.totalVisitors = (this.data.totalVisitors || 0) + 1;
    this.data.todayVisitors = (this.data.todayVisitors || 0) + 1;
    this.scheduleSave();
  }

  /**
   * Record a page view event when a user navigates to a section.
   *
   * @param {string} pageKey - Name of page ('attendance', 'timetable', 'marks', etc.)
   */
  recordPageView(pageKey) {
    const key = String(pageKey || 'home').toLowerCase().trim();
    this.data.totalPageViews = (this.data.totalPageViews || 0) + 1;

    if (this.data.pageViews[key] !== undefined) {
      this.data.pageViews[key] += 1;
    } else {
      this.data.pageViews[key] = 1;
    }

    this.scheduleSave();
  }

  /**
   * Record one or more user clicks.
   *
   * @param {number} [count=1] - Number of clicks to accumulate
   */
  recordClicks(count = 1) {
    const inc = Math.max(1, parseInt(count, 10) || 1);
    this.data.totalClicks = (this.data.totalClicks || 0) + inc;
    this.scheduleSave();
  }

  /**
   * Record attendance marked event.
   *
   * @param {number} [count=1] - Number of students marked
   */
  recordAttendanceMarked(count = 1) {
    const inc = Math.max(1, parseInt(count, 10) || 1);
    this.data.totalAttendancesMarked = (this.data.totalAttendancesMarked || 0) + inc;
    this.scheduleSave();
  }

  /**
   * Reset all analytics counters back to zero.
   *
   * @returns {object} Formatted stats with all counters reset
   */
  resetStats() {
    this.data.totalVisitors = 0;
    this.data.todayVisitors = 0;
    this.data.todayDate = this.getCurrentDateKey();
    this.data.totalClicks = 0;
    this.data.totalAttendancesMarked = 0;
    this.data.totalPageViews = 0;
    this.data.pageViews = {
      home: 0,
      attendance: 0,
      timetable: 0,
      marks: 0,
      profile: 0,
      mark: 0
    };

    this.saveImmediately();
    return this.getStats();
  }

  /**
   * Get formatted analytics overview.
   *
   * @returns {object} Analytics metrics
   */
  getStats() {
    this.checkAndResetDayRollover();

    return {
      totalVisitors: this.data.totalVisitors || 0,
      todayVisitors: this.data.todayVisitors || 0,
      todayDate: this.data.todayDate,
      totalClicks: this.data.totalClicks || 0,
      totalAttendancesMarked: this.data.totalAttendancesMarked || 0,
      totalPageViews: this.data.totalPageViews || 0,
      pageViews: {
        attendance: this.data.pageViews.attendance || 0,
        timetable: this.data.pageViews.timetable || 0,
        marks: this.data.pageViews.marks || 0,
        mark: this.data.pageViews.mark || 0,
        home: this.data.pageViews.home || 0,
        profile: this.data.pageViews.profile || 0
      }
    };
  }
}

export const analyticsService = new AnalyticsService();
