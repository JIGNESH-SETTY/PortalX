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
 * Safely parse a mark value (float), preserving null when marks have not yet been entered.
 *
 * @param {string} text
 * @returns {number|null}
 */
function parseMark(text) {
  const val = clean(text);
  if (val === '' || val === '-' || val === '--' || val.toLowerCase() === 'absent' || val.toLowerCase() === 'ab') {
    return null;
  }
  const num = parseFloat(val);
  return Number.isNaN(num) ? null : num;
}

/**
 * Check if a string looks like an SRM course code (e.g. "CSE 202", "CSE202", "MAT 279", "SEC 203").
 *
 * @param {string} text
 * @returns {boolean}
 */
function isCourseCode(text) {
  return /^[A-Z]{2,4}\s*\d{3}[A-Z]?$/i.test(clean(text));
}

/**
 * Parse internal marks HTML returned by SRM report endpoint (ids=5).
 * Extracts both top-level subject marks and granular component assessments (CLA, Midterm, etc.).
 *
 * @param {string} html - Raw HTML from SRM portal
 * @returns {{ rows: Array, subjects: Array }}
 */
export function parseMarksHtml(html) {
  const result = {
    rows: [],
    subjects: []
  };

  if (!html || typeof html !== 'string') {
    return result;
  }

  const $ = cheerio.load(html);
  const tables = $('table');

  // Strategy A: Identify master summary table
  let summaryTable = tables.filter((_, tbl) => {
    const text = $(tbl).text().toLowerCase();
    const hasCode = text.includes('code') || text.includes('course') || text.includes('subject');
    const hasMark = text.includes('mark') || text.includes('internal') || text.includes('obtained') || text.includes('secured') || text.includes('assessment');
    const isDetailed = text.includes('detailed assessment') || text.includes('assessment name') || text.includes('conducted mark');
    return hasCode && hasMark && !isDetailed;
  }).first();

  if (summaryTable.length > 0) {
    const allTrs = summaryTable.find('tr');
    if (allTrs.length >= 2) {
      let headerRow = allTrs.first();
      if (headerRow.find('th, td').length <= 2 && allTrs.length > 2) {
        headerRow = allTrs.eq(1);
      }

      const colPositions = [];
      headerRow.find('th, td').each((_, cell) => {
        colPositions.push(clean($(cell).text()).toLowerCase());
      });

      let codeIdx = colPositions.findIndex(h => h.includes('code'));
      let descIdx = colPositions.findIndex(h => (h.includes('desc') || h.includes('title') || h.includes('name') || h.includes('subject')) && !h.includes('code'));

      // Distinguish obtained vs max marks cleanly
      let maxIdx = colPositions.findIndex(h => h.includes('max') || (h.includes('total') && (h.includes('mark') || h.includes('score'))));
      let obtIdx = colPositions.findIndex((h, idx) => {
        if (idx === maxIdx) return false;
        return h.includes('obtain') || h.includes('secured') || h.includes('internal') || h.includes('scored') || (h.includes('mark') && !h.includes('max') && !h.includes('total'));
      });

      allTrs.each((_, tr) => {
        const cells = $(tr).find('td');
        if (cells.length < 3) return;

        const rowText = clean($(tr).text()).toUpperCase();
        if (rowText.includes('TOTAL') || rowText.includes('AVERAGE') || rowText.includes('COURSE CODE')) {
          return;
        }

        const cell0Text = clean($(cells[0]).text());
        const cell1Text = clean($(cells[1]).text());

        let hasSlNo = false;
        let cIdx = codeIdx;
        let dIdx = descIdx;

        if (/^\d+$/.test(cell0Text) && isCourseCode(cell1Text)) {
          hasSlNo = true;
          if (cIdx === -1) cIdx = 1;
          if (dIdx === -1) dIdx = 2;
        } else if (isCourseCode(cell0Text)) {
          hasSlNo = false;
          cIdx = 0;
          if (dIdx === -1 || dIdx === 0) dIdx = 1;
        } else if (cIdx !== -1 && isCourseCode(clean($(cells[cIdx]).text()))) {
          hasSlNo = cIdx > 0;
        } else {
          for (let i = 0; i < Math.min(3, cells.length); i++) {
            if (isCourseCode(clean($(cells[i]).text()))) {
              cIdx = i;
              dIdx = i + 1;
              hasSlNo = i > 0;
              break;
            }
          }
        }

        if (cIdx === -1 || cIdx >= cells.length) return;

        const code = clean($(cells[cIdx]).text()).toUpperCase();
        if (!code || !isCourseCode(code)) return;

        const description = (dIdx !== -1 && dIdx < cells.length) ? clean($(cells[dIdx]).text()) : '';

        const baseOffset = hasSlNo ? 1 : 0;
        const curObtIdx = obtIdx !== -1 ? obtIdx : baseOffset + 2;
        const curMaxIdx = maxIdx !== -1 ? maxIdx : (curObtIdx + 1 < cells.length ? curObtIdx + 1 : cells.length - 1);

        const obtained = curObtIdx < cells.length ? parseMark($(cells[curObtIdx]).text()) : null;
        const maxVal = curMaxIdx < cells.length ? parseMark($(cells[curMaxIdx]).text()) : null;
        const max = maxVal ?? 50;

        result.rows.push([
          code,
          obtained ?? 0,
          max
        ]);

        result.subjects.push({
          code,
          description,
          obtained,
          max,
          isPublished: obtained !== null,
          components: []
        });
      });
    }
  }

  // Strategy B: Parse detailed assessment breakdown tables
  tables.each((_, tbl) => {
    const tableText = $(tbl).text().toLowerCase();
    if (!tableText.includes('assessment') && !tableText.includes('cla') && !tableText.includes('mid sem') && !tableText.includes('component')) {
      return;
    }

    // Find the associated course code
    let courseCode = '';
    const tblId = $(tbl).attr('id') || $(tbl).attr('data-code') || '';
    const idMatch = tblId.match(/([A-Z]{2,4}\s*\d{3}[A-Z]?)/i);
    if (idMatch) {
      courseCode = clean(idMatch[1]).toUpperCase();
    }

    if (!courseCode) {
      let prev = $(tbl).prev();
      while (prev.length > 0) {
        const txt = prev.text();
        const m = txt.match(/([A-Z]{2,4}\s*\d{3}[A-Z]?)/i);
        if (m) {
          courseCode = clean(m[1]).toUpperCase();
          break;
        }
        prev = prev.prev();
      }
    }

    const trs = $(tbl).find('tr');
    if (trs.length < 2) return;

    const components = [];
    trs.slice(1).each((_, tr) => {
      const cells = $(tr).find('td');
      if (cells.length < 2) return;

      const assessmentName = clean($(cells[0]).text());
      if (!assessmentName || assessmentName.toLowerCase().includes('assessment') || assessmentName.toLowerCase().includes('total')) return;

      const conducted = parseMark($(cells[1]).text());
      const max = cells.length > 2 ? parseMark($(cells[2]).text()) : 100;
      const converted = cells.length > 3 ? parseMark($(cells[3]).text()) : null;

      components.push({
        name: assessmentName,
        conducted,
        max,
        converted
      });
    });

    if (components.length > 0) {
      if (courseCode) {
        const subject = result.subjects.find(s => s.code === courseCode);
        if (subject) {
          subject.components = components;
        } else {
          // If subject wasn't in summary table, synthesize it
          const got = components.reduce((sum, c) => sum + (c.converted ?? c.conducted ?? 0), 0);
          const maxGot = components.reduce((sum, c) => sum + (c.max ?? 50), 0) || 50;
          result.rows.push([courseCode, Number(got.toFixed(2)), maxGot]);
          result.subjects.push({
            code: courseCode,
            description: '',
            obtained: Number(got.toFixed(2)),
            max: maxGot,
            isPublished: true,
            components
          });
        }
      }
    }
  });

  return result;
}
