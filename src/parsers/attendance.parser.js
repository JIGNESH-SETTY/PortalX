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
 * Safely parse a numeric integer.
 *
 * @param {string} text
 * @returns {number|null}
 */
function parseNum(text) {
  const val = clean(text);
  if (val === '' || val === '-' || val === '--') return null;
  const num = parseInt(val, 10);
  return Number.isNaN(num) ? null : num;
}

/**
 * Safely parse a floating-point percentage.
 *
 * @param {string} text
 * @returns {number|null}
 */
function parsePct(text) {
  const val = clean(text).replace(/%$/, '').trim();
  if (val === '' || val === '-' || val === '--') return null;
  const num = parseFloat(val);
  return Number.isNaN(num) ? null : num;
}

/**
 * Check if a header refers to On-Duty / Medical Leave (OD/ML).
 *
 * @param {string} header
 * @returns {boolean}
 */
function isOdmlHeader(header) {
  if (!header || header.includes('code')) return false;
  return /\b(od|ml)\b/i.test(header) || header.includes('od/ml') || header.includes('od / ml') || header.includes('duty') || header.includes('medical');
}

/**
 * Check if a string looks like an SRM course code (e.g. "CSE 202", "CSE202", "MAT 279", "SEC 203").
 *
 * @param {string} text
 * @returns {boolean}
 */
function isCourseCode(text) {
  return /^[A-Z]{2,4}\s*\d{3}/i.test(clean(text));
}

/**
 * Parse attendance HTML returned by SRM report endpoint (ids=3).
 *
 * @param {string} html - Raw HTML from SRM portal
 * @returns {{ from: string, to: string, rows: Array, subjects: Array, summary: object }}
 */
export function parseAttendanceHtml(html) {
  const result = {
    from: '',
    to: '',
    rows: [],
    subjects: [],
    summary: {
      totalConducted: 0,
      totalPresent: 0,
      totalAbsent: 0,
      totalOdml: 0,
      averagePercentage: 0,
      officialPercentage: null
    }
  };

  if (!html || typeof html !== 'string') {
    return result;
  }

  const $ = cheerio.load(html);
  const fullText = $.text();

  // 1. Extract Date Range (e.g. "From : 03/Aug/2026 To : 27/Oct/2026")
  const dateMatch = fullText.match(/From\s*[:\-]?\s*([0-9]{1,2}[/\-][A-Za-z0-9]{2,4}[/\-][0-9]{4})\s*To\s*[:\-]?\s*([0-9]{1,2}[/\-][A-Za-z0-9]{2,4}[/\-][0-9]{4})/i);
  if (dateMatch) {
    result.from = dateMatch[1];
    result.to = dateMatch[2];
  }

  // 2. Extract official overall attendance percentage from header text if present
  const overallMatch = fullText.match(/(?:Overall|Average|Total)\s*Attendance\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i);
  if (overallMatch) {
    const ovVal = parseFloat(overallMatch[1]);
    if (!isNaN(ovVal) && ovVal > 0 && ovVal <= 100) {
      result.summary.officialPercentage = ovVal;
    }
  }

  // 3. Locate the attendance table
  let table = $('#tblSubjectWiseAttendance');
  if (table.length === 0) {
    table = $('table').filter((_, tbl) => {
      const text = $(tbl).text().toLowerCase();
      const hasCourse = text.includes('code') || text.includes('subject');
      const hasClasses = text.includes('conduct') || text.includes('present') || text.includes('attend') || text.includes('slot') || text.includes('hour');
      return hasCourse && hasClasses;
    }).first();
  }

  if (table.length > 0) {
    const allTrs = table.find('tr');
    if (allTrs.length >= 2) {
      // Find header row
      let headerRow = allTrs.first();
      if (headerRow.find('th, td').length <= 2 && allTrs.length > 2) {
        headerRow = allTrs.eq(1);
      }

      const headers = [];
      headerRow.find('th, td').each((_, cell) => {
        headers.push(clean($(cell).text()).toLowerCase());
      });

      // Match column indices by official SRM header names
      let codeIdx = headers.findIndex(h => h.includes('code'));
      let descIdx = headers.findIndex(h => (h.includes('title') || h.includes('desc') || h.includes('name') || h.includes('subject')) && !h.includes('code') && !h.includes('faculty') && !h.includes('staff'));
      let condIdx = headers.findIndex(h => h.includes('conduct') || h.includes('scheduled') || h.includes('total class') || h.includes('total slot') || h.includes('total hour'));
      let presIdx = headers.findIndex(h => (h.includes('present') || h.includes('attended')) && !h.includes('%') && !h.includes('percent'));
      let absIdx = headers.findIndex(h => h.includes('absent') && !h.includes('%') && !h.includes('percent'));
      let odmlIdx = headers.findIndex(h => isOdmlHeader(h) && !h.includes('%') && !h.includes('percent'));

      let presPctIdx = headers.findIndex(h => (h.includes('present') || h.includes('attended')) && (h.includes('%') || h.includes('percent')) && !h.includes('total'));
      let odmlPctIdx = headers.findIndex(h => isOdmlHeader(h) && (h.includes('%') || h.includes('percent')));

      // Direct search for "Total Attendance Percentage" column (look from the right)
      let totalAttPctIdx = -1;
      for (let i = headers.length - 1; i >= 0; i--) {
        const h = headers[i];
        if (h.includes('total attendance') || h.includes('total %') || h.includes('total att') || (h.includes('attendance') && (h.includes('%') || h.includes('percent')))) {
          totalAttPctIdx = i;
          break;
        }
      }
      if (totalAttPctIdx === -1) {
        for (let i = headers.length - 1; i >= 0; i--) {
          const h = headers[i];
          if ((h.includes('%') || h.includes('percent') || h === 'percentage') && i !== presPctIdx && i !== odmlPctIdx) {
            totalAttPctIdx = i;
            break;
          }
        }
      }

      // Iterate through data rows
      allTrs.each((_, tr) => {
        const cells = $(tr).find('td');
        if (cells.length < 4) return;

        const rowText = clean($(tr).text()).toUpperCase();
        if (rowText.includes('TOTAL') || rowText.includes('AVERAGE')) {
          // Check if this summary footer row has an overall attendance percentage
          cells.each((_, c) => {
            const p = parsePct($(c).text());
            if (p !== null && p > 0 && p <= 100) {
              result.summary.officialPercentage = p;
            }
          });
          return;
        }
        if (rowText.includes('COURSE CODE')) {
          return;
        }

        // Determine if cells[0] is Sl.No (numeric) or directly Course Code
        const c0 = clean($(cells[0]).text());
        const c1 = clean($(cells[1]).text());

        let curCodeIdx = codeIdx !== -1 ? codeIdx : (/^\d+$/.test(c0) && isCourseCode(c1) ? 1 : 0);
        let curDescIdx = descIdx !== -1 ? descIdx : (curCodeIdx + 1);

        const code = clean($(cells[curCodeIdx]).text()).toUpperCase();
        if (!code || !isCourseCode(code)) return;

        const description = curDescIdx < cells.length ? clean($(cells[curDescIdx]).text()) : '';

        // Extract counts
        const baseOffset = curCodeIdx > 0 ? 1 : 0;
        const cCond = condIdx !== -1 ? condIdx : baseOffset + 2;
        const cPres = presIdx !== -1 ? presIdx : baseOffset + 3;
        const cAbs = absIdx !== -1 ? absIdx : baseOffset + 4;
        const cOd = odmlIdx !== -1 ? odmlIdx : baseOffset + 5;
        const cPresPct = presPctIdx !== -1 ? presPctIdx : baseOffset + 6;
        const cOdPct = odmlPctIdx !== -1 ? odmlPctIdx : baseOffset + 7;
        const cTotalAttPct = totalAttPctIdx !== -1 ? totalAttPctIdx : (cells.length - 1);

        let conducted = cCond < cells.length ? parseNum($(cells[cCond]).text()) : null;
        let present = cPres < cells.length ? parseNum($(cells[cPres]).text()) : null;
        let absent = cAbs < cells.length ? parseNum($(cells[cAbs]).text()) : null;
        let odml = cOd < cells.length ? parseNum($(cells[cOd]).text()) : null;

        conducted = conducted ?? 0;
        present = present ?? 0;
        odml = odml ?? 0;

        // Formula: absent is remaining total minus present plus od
        if (absent === null) {
          absent = Math.max(0, conducted - (present + odml));
        }

        // 1. Fetch exact Total Attendance Percentage from the portal column
        let totalAttPct = cTotalAttPct < cells.length ? parsePct($(cells[cTotalAttPct]).text()) : null;
        let presentPct = cPresPct < cells.length ? parsePct($(cells[cPresPct]).text()) : null;
        let odmlPct = cOdPct < cells.length ? parsePct($(cells[cOdPct]).text()) : null;

        // 2. If the column value was empty or unread, calculate: (total present + od approved) / total classes * 100
        if (totalAttPct === null || totalAttPct === 0) {
          totalAttPct = conducted > 0 ? Number((((present + odml) / conducted) * 100).toFixed(2)) : 0;
        }

        // Present % and OD % fallbacks
        if (presentPct === null) {
          presentPct = conducted > 0 ? Number(((present / conducted) * 100).toFixed(2)) : 0;
        }
        if (odmlPct === null) {
          odmlPct = conducted > 0 && odml > 0 ? Number(((odml / conducted) * 100).toFixed(2)) : 0;
        }

        totalAttPct = Number(totalAttPct.toFixed(2));
        presentPct = Number(presentPct.toFixed(2));
        odmlPct = Number(odmlPct.toFixed(2));

        result.rows.push([
          code,
          conducted,
          present,
          absent,
          odml,
          presentPct,
          odmlPct,
          totalAttPct
        ]);

        result.subjects.push({
          code,
          description,
          conducted,
          present,
          absent,
          odml,
          presentPercentage: presentPct,
          odmlPercentage: odmlPct,
          attendancePercentage: totalAttPct
        });
      });
    }
  }

  // Calculate overall summary
  if (result.rows.length > 0) {
    const totalConducted = result.rows.reduce((sum, r) => sum + r[1], 0);
    const totalPresent = result.rows.reduce((sum, r) => sum + r[2], 0);
    const totalAbsent = result.rows.reduce((sum, r) => sum + r[3], 0);
    const totalOdml = result.rows.reduce((sum, r) => sum + r[4], 0);
    const avgPct = result.rows.reduce((sum, r) => sum + r[7], 0) / result.rows.length;

    result.summary = {
      totalConducted,
      totalPresent,
      totalAbsent,
      totalOdml,
      averagePercentage: Number(avgPct.toFixed(2)),
      officialPercentage: result.summary.officialPercentage ?? Number(avgPct.toFixed(2))
    };
  }

  return result;
}
