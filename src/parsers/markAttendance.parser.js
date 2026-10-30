import * as cheerio from 'cheerio';

/**
 * Clean whitespace and HTML entities.
 *
 * @param {string} text
 * @returns {string}
 */
function clean(text) {
  if (!text) return '';
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse Mark Attendance HTML returned by SRM page (studentattendance.jsp).
 * Extracts current day order, today's attendance table, and dynamic submission tokens.
 *
 * @param {string} html - Raw HTML from studentattendance.jsp
 * @returns {object} Structured attendance status and records
 */
export function parseMarkAttendanceHtml(html) {
  const result = {
    dayOrder: '',
    todayAttendance: [],
    onlineAttendance: [],
    dynamiclatdata: '',
    dynamiclonxdata: '',
    codeLength: 7
  };

  if (!html || typeof html !== 'string') {
    return result;
  }

  const $ = cheerio.load(html);

  // 1. Extract Day Order (e.g., "Day Order : Day 3" or "Day Order: 2")
  // Check leaf elements that contain "Day Order"
  let extractedDayOrder = '';
  $('span, div, p, b, td, h3, h4').each((_, el) => {
    if ($(el).children().length > 0) return;
    const txt = clean($(el).text());
    const m = txt.match(/Day\s*Order\s*[:\-]?\s*(Day\s*\d+|\d+|[A-Za-z0-9]+)/i);
    if (m && !extractedDayOrder) {
      extractedDayOrder = clean(m[1]);
    }
  });

  if (!extractedDayOrder) {
    const text = $.text();
    const dayOrderMatch = text.match(/Day\s*Order\s*[:\-]?\s*(Day\s*\d+|\d+)/i);
    if (dayOrderMatch) {
      extractedDayOrder = clean(dayOrderMatch[1]);
    }
  }
  result.dayOrder = extractedDayOrder;

  // 2. Extract Dynamic Lat/Lon Tokens if present in hidden inputs or script variables
  const latInput = $('input[name="dynamiclatdata"], #dynamiclatdata').val();
  const lonInput = $('input[name="dynamiclonxdata"], #dynamiclonxdata').val();
  if (latInput) result.dynamiclatdata = latInput;
  if (lonInput) result.dynamiclonxdata = lonInput;

  // Also check inline script definitions for dynamiclatdata / dynamiclonxdata
  $('script').each((_, script) => {
    const content = $(script).html() || '';
    const latMatch = content.match(/dynamiclatdata\s*=\s*['"]([^'"]*)['"]/i);
    const lonMatch = content.match(/dynamiclonxdata\s*=\s*['"]([^'"]*)['"]/i);
    if (latMatch && !result.dynamiclatdata) result.dynamiclatdata = latMatch[1];
    if (lonMatch && !result.dynamiclonxdata) result.dynamiclonxdata = lonMatch[1];
  });

  // 3. Extract Today's Attendance Table
  $('table').each((_, tbl) => {
    const tableText = $(tbl).text().toLowerCase();
    if (!tableText.includes('hour') && !tableText.includes('subject') && !tableText.includes('status')) {
      return;
    }

    const trs = $(tbl).find('tr');
    if (trs.length < 2) return;

    trs.slice(1).each((_, tr) => {
      const cells = $(tr).find('td');
      if (cells.length < 4) return;

      const date = clean($(cells[0]).text());
      const dayOrder = clean($(cells[1]).text());
      const hour = clean($(cells[2]).text());
      const subject = clean($(cells[3]).text());
      const status = cells.length > 4 ? clean($(cells[4]).text()) : 'Marked';

      if (subject && !subject.toLowerCase().includes('subject')) {
        result.todayAttendance.push({
          date,
          dayOrder,
          hour,
          subject,
          status
        });
      }
    });
  });

  return result;
}
