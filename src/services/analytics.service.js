import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');

/**
 * Service to record and retrieve user interaction analytics.
 * Tracks unique monthly viewers, total clicks, attendance submissions,
 * and granular per-page view statistics.
 */
class AnalyticsService {
  constructor() {
    /** In-memory store */
    this.data = {
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
      },
      monthlyViewers: {},
      recentActivity: []
    };

    this.saveTimeout = null;
    this.init();
  }

  /**
   * Initialize data directory and load existing analytics from disk if available.
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
          ...this.data,
          ...parsed,
          pageViews: {
            ...this.data.pageViews,
            ...(parsed.pageViews || {})
          },
          monthlyViewers: parsed.monthlyViewers || {},
          recentActivity: parsed.recentActivity || []
        };
      } else {
        this.saveImmediately();
      }
    } catch (err) {
      console.warn('[AnalyticsService] Notice during storage initialization:', err.message);
    }
  }

  /**
   * Persist current in-memory stats to disk with debouncing.
   */
  scheduleSave() {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.saveImmediately();
    }, 1000);
  }

  /**
   * Write data synchronously or immediately to disk.
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
   * Get current month identifier in YYYY-MM format.
   * @returns {string} e.g. "2026-11"
   */
  getCurrentMonthKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  /**
   * Get human readable current month name.
   * @returns {string} e.g. "November 2026"
   */
  getCurrentMonthName() {
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  /**
   * Register a unique viewer for the current month.
   *
   * @param {string} [identifier] - Client IP, session ID, or identifier
   */
  recordViewer(identifier) {
    if (!identifier) return;
    const month = this.getCurrentMonthKey();
    if (!this.data.monthlyViewers[month]) {
      this.data.monthlyViewers[month] = [];
    }

    const hashed = crypto.createHash('sha256').update(String(identifier)).digest('hex').slice(0, 16);
    if (!this.data.monthlyViewers[month].includes(hashed)) {
      this.data.monthlyViewers[month].push(hashed);
      this.scheduleSave();
    }
  }

  /**
   * Record a page view event.
   *
   * @param {string} pageKey - Name of page ('attendance', 'timetable', 'marks', etc.)
   * @param {string} [clientIdentifier] - Client IP or session ID
   */
  recordPageView(pageKey, clientIdentifier = null) {
    const key = String(pageKey || 'home').toLowerCase().trim();
    this.data.totalPageViews = (this.data.totalPageViews || 0) + 1;

    if (this.data.pageViews[key] !== undefined) {
      this.data.pageViews[key] += 1;
    } else {
      this.data.pageViews[key] = 1;
    }

    if (clientIdentifier) {
      this.recordViewer(clientIdentifier);
    }

    this.addActivity(`Viewed ${key.charAt(0).toUpperCase() + key.slice(1)} page`);
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
   * @param {string} [extraInfo] - Optional label
   */
  recordAttendanceMarked(count = 1, extraInfo = '') {
    const inc = Math.max(1, parseInt(count, 10) || 1);
    this.data.totalAttendancesMarked = (this.data.totalAttendancesMarked || 0) + inc;

    const label = count > 1
      ? `Group attendance marked (${count} students)`
      : `Attendance marked ${extraInfo ? `(${extraInfo})` : ''}`.trim();

    this.addActivity(label);
    this.scheduleSave();
  }

  /**
   * Add an entry to the recent activity feed (capped at 20 entries).
   *
   * @param {string} description
   */
  addActivity(description) {
    if (!description) return;
    const entry = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      description,
      timestamp: Date.now()
    };

    if (!Array.isArray(this.data.recentActivity)) {
      this.data.recentActivity = [];
    }

    this.data.recentActivity.unshift(entry);
    if (this.data.recentActivity.length > 25) {
      this.data.recentActivity = this.data.recentActivity.slice(0, 25);
    }
  }

  /**
   * Get formatted analytics overview.
   *
   * @returns {object} Analytics metrics
   */
  getStats() {
    const month = this.getCurrentMonthKey();
    const currentMonthViewersList = this.data.monthlyViewers[month] || [];
    const viewersThisMonth = currentMonthViewersList.length;

    return {
      currentMonth: this.getCurrentMonthName(),
      viewersThisMonth,
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
      },
      recentActivity: (this.data.recentActivity || []).slice(0, 15)
    };
  }
}

export const analyticsService = new AnalyticsService();
