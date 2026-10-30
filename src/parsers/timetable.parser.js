import * as cheerio from 'cheerio';

/**
 * Standard university period slots.
 */
export const DEFAULT_PERIOD_SLOTS = [
  ['09:00', '09:50'],
  ['10:00', '10:50'],
  ['11:00', '11:50'],
  ['12:00', '12:50'],
  ['13:00', '13:50'],
  ['14:00', '14:50'],
  ['15:00', '15:50'],
  ['16:00', '17:30']
];

const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
 * Parse an individual cell from the timetable grid.
 * Returns "CODE:ROOM" if occupied, or 0 if free.
 *
 * @param {string} cellText
 * @returns {string|number}
 */
function parseTimetableCell(cellText) {
  const text = clean(cellText);
  if (!text || text === '-' || text === 'NIL' || text.toLowerCase() === 'free' || text === '--') {
    return 0;
  }

  // Handle patterns like:
  // "CSE 213:S 404"
  // "CSE 213 / S 404"
  // "CSE 213 (S 404)"
  // "CSE 213 - S 404"
  // "CSE 213\nS 404"
  const colonMatch = text.match(/^([A-Z]{2,4}\s*\d{3}[A-Z]?)\s*[:/\-\n]\s*(.+)$/i);
  if (colonMatch) {
    const code = clean(colonMatch[1]).toUpperCase();
    const room = clean(colonMatch[2]);
    return `${code}:${room}`;
  }

  const parenMatch = text.match(/^([A-Z]{2,4}\s*\d{3}[A-Z]?)\s*\(([^)]+)\)$/i);
  if (parenMatch) {
    const code = clean(parenMatch[1]).toUpperCase();
    const room = clean(parenMatch[2]);
    return `${code}:${room}`;
  }

  // Two tokens where first is subject code (e.g. "CSE 213 S 404" or "CSE202 C804")
  const spaceMatch = text.match(/^([A-Z]{2,4}\s*\d{3}[A-Z]?)\s+([A-Z]\s*\d{3,4})$/i);
  if (spaceMatch) {
    const code = clean(spaceMatch[1]).toUpperCase();
    const room = clean(spaceMatch[2]);
    return `${code}:${room}`;
  }

  // If only subject code is present
  const codeOnlyMatch = text.match(/^([A-Z]{2,4}\s*\d{3}[A-Z]?)$/i);
  if (codeOnlyMatch) {
    return `${clean(codeOnlyMatch[1]).toUpperCase()}:`;
  }

  // If unstructured text is present, return cleaned string
  return text.includes(':') ? text : `${text}:`;
}

/**
 * Parse timetable HTML returned by SRM report endpoint (ids=10).
 * Extracts weekly schedule grid and subject list.
 *
 * @param {string} html - Raw HTML from SRM portal
 * @returns {{ days: object, subjects: Array, periods: Array }}
 */
export function parseTimetableHtml(html) {
  const result = {
    days: {
      Mon: [0, 0, 0, 0, 0, 0, 0, 0],
      Tue: [0, 0, 0, 0, 0, 0, 0, 0],
      Wed: [0, 0, 0, 0, 0, 0, 0, 0],
      Thu: [0, 0, 0, 0, 0, 0, 0, 0],
      Fri: [0, 0, 0, 0, 0, 0, 0, 0],
      Sat: [0, 0, 0, 0, 0, 0, 0, 0]
    },
    subjects: [],
    periods: DEFAULT_PERIOD_SLOTS
  };

  if (!html || typeof html !== 'string') {
    return result;
  }

  const $ = cheerio.load(html);

  // 1. Parse Class Timetable Grid (#tblClassTimetable)
  let timetableTable = $('#tblClassTimetable');
  if (timetableTable.length === 0) {
    // Fallback: look for table containing days of the week in rows
    timetableTable = $('table').filter((_, table) => {
      const text = $(table).text().toLowerCase();
      return text.includes('mon') && text.includes('tue') && text.includes('wed');
    }).first();
  }

  if (timetableTable.length > 0) {
    timetableTable.find('tr').each((_, tr) => {
      const cells = $(tr).find('td, th');
      if (cells.length < 2) return;

      const firstCellText = clean($(cells[0]).text()).toLowerCase();

      // Identify which day of the week this row represents
      let matchedDay = null;
      if (firstCellText.startsWith('mon')) matchedDay = 'Mon';
      else if (firstCellText.startsWith('tue')) matchedDay = 'Tue';
      else if (firstCellText.startsWith('wed')) matchedDay = 'Wed';
      else if (firstCellText.startsWith('thu')) matchedDay = 'Thu';
      else if (firstCellText.startsWith('fri')) matchedDay = 'Fri';
      else if (firstCellText.startsWith('sat')) matchedDay = 'Sat';

      if (matchedDay) {
        const daySlots = [];
        // Loop through period columns (1 to 8)
        for (let i = 1; i < cells.length && daySlots.length < 8; i++) {
          const cellContent = $(cells[i]).html() || '';
          // Convert <br> tags to newlines before parsing
          const textWithBreaks = cheerio.load(cellContent.replace(/<br\s*\/?>/gi, '\n')).text();
          daySlots.push(parseTimetableCell(textWithBreaks));
        }

        // Fill remaining slots up to 8 if necessary
        while (daySlots.length < 8) {
          daySlots.push(0);
        }

        result.days[matchedDay] = daySlots;
      }
    });
  }

  // 2. Parse Subject List Table (#tblSubjectList)
  let subjectTable = $('#tblSubjectList');
  if (subjectTable.length === 0) {
    // Fallback: look for table containing headers "Course Code", "Subject Code", or "Subjects Description"
    subjectTable = $('table').filter((_, table) => {
      const text = $(table).text().toLowerCase();
      return (text.includes('course code') || text.includes('subject code') || text.includes('subjects description')) && (text.includes('faculty') || text.includes('l-t-p-c'));
    }).first();
  }

  if (subjectTable.length > 0) {
    subjectTable.find('tr').slice(1).each((_, tr) => {
      const cells = $(tr).find('td');
      if (cells.length < 4) return;

      const firstText = clean($(cells[0]).text());
      const isFirstNumeric = /^\d+$/.test(firstText);

      let code, name, ltpc, facultyHtml, roomsText;
      if (isFirstNumeric && cells.length >= 5) {
        // [Sl.No, Course Code, Course Title, LTPC, Faculty, Room]
        code = clean($(cells[1]).text()).toUpperCase();
        name = clean($(cells[2]).text());
        ltpc = clean($(cells[3]).text());
        facultyHtml = $(cells[4]).html() || '';
        roomsText = clean($(cells[5]).text());
      } else {
        // [Course Code, Course Title, LTPC, Faculty, Room]
        code = clean($(cells[0]).text()).toUpperCase();
        name = clean($(cells[1]).text());
        ltpc = clean($(cells[2]).text());
        facultyHtml = $(cells[3]).html() || '';
        roomsText = clean($(cells[4]).text());
      }

      if (!code || code.toLowerCase().includes('code') || code.toLowerCase().includes('description')) return;

      // Parse faculty list (handles <br>, newlines, or comma-separated faculty names like "Dr. ...")
      const faculty = facultyHtml
        .split(/<br\s*\/?>|\n|,\s*(?=(?:Dr\.|Mr\.|Ms\.|Mrs\.|[A-Z][a-z]+))/i)
        .map(f => cheerio.load(f).text().trim())
        .filter(Boolean);

      // Parse rooms (cleans parentheses and splits commas/slashes)
      const rooms = roomsText
        ? roomsText.split(/[,;\n/]+/).map(r => r.replace(/[()]/g, '').trim()).filter(Boolean)
        : [];

      result.subjects.push({
        code,
        name,
        ltpc: ltpc || '0-0-0-0',
        faculty: faculty.length > 0 ? faculty : ['Faculty Assigned'],
        rooms: rooms.length > 0 ? rooms : []
      });
    });
  }

  return result;
}

