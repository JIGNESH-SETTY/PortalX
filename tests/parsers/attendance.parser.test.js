import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAttendanceHtml } from '../../src/parsers/attendance.parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.join(__dirname, '..', 'fixtures', 'attendance.html');

test('parseAttendanceHtml correctly extracts date range, rows, and percentages', () => {
  const html = fs.readFileSync(fixturePath, 'utf-8');
  const attendance = parseAttendanceHtml(html);

  assert.equal(attendance.from, '03/Aug/2026');
  assert.equal(attendance.to, '27/Oct/2026');

  assert.equal(attendance.rows.length, 4);

  // Check CSE 202 row: [code, conducted, present, absent, odml, present%, odml%, attendance%]
  const row0 = attendance.rows[0];
  assert.equal(row0[0], 'CSE 202');
  assert.equal(row0[1], 49); // Conducted
  assert.equal(row0[2], 46); // Present
  assert.equal(row0[3], 0);  // Absent
  assert.equal(row0[4], 3);  // OD/ML
  assert.equal(row0[5], 93.88); // Present %
  assert.equal(row0[6], 4.00);  // OD/ML %
  assert.equal(row0[7], 97.88); // Total Attendance %

  // Verify second row
  const row1 = attendance.rows[1];
  assert.equal(row1[0], 'CSE 203');
  assert.equal(row1[1], 28);
  assert.equal(row1[2], 26);
  assert.equal(row1[3], 2);
  assert.equal(row1[7], 92.86);

  // Verify summary calculation
  assert.equal(attendance.summary.totalConducted, 49 + 28 + 52 + 18);
  assert.equal(attendance.summary.totalPresent, 46 + 26 + 48 + 16);
  assert.ok(attendance.summary.averagePercentage > 90);
});

test('parseAttendanceHtml handles empty HTML gracefully', () => {
  const res = parseAttendanceHtml('');
  assert.deepEqual(res.rows, []);
  assert.equal(res.from, '');
  assert.equal(res.to, '');
});

test('parseAttendanceHtml accurately extracts Total Attendance % when Attended % and OD % columns exist', () => {
  const html = `
    <div>
      <div>Attendance Report From : 01/Aug/2026 To : 25/Oct/2026</div>
      <table>
        <tr>
          <th>Course Code</th>
          <th>Course Title</th>
          <th>Conducted</th>
          <th>Attended</th>
          <th>Absent</th>
          <th>OD</th>
          <th>Attended %</th>
          <th>OD %</th>
          <th>Total Attendance %</th>
        </tr>
        <tr>
          <td>CSE 202</td>
          <td>OOP with C++</td>
          <td>49</td>
          <td>46</td>
          <td>0</td>
          <td>3</td>
          <td>93.88%</td>
          <td>4.00%</td>
          <td>97.88%</td>
        </tr>
      </table>
    </div>
  `;
  const res = parseAttendanceHtml(html);
  assert.equal(res.rows.length, 1);
  const row = res.rows[0];
  assert.equal(row[0], 'CSE 202');
  assert.equal(row[1], 49);
  assert.equal(row[2], 46);
  assert.equal(row[3], 0);
  assert.equal(row[4], 3);
  assert.equal(row[5], 93.88); // Attended / Present %
  assert.equal(row[6], 4.00);  // OD %
  assert.equal(row[7], 97.88); // Total Attendance % MUST NOT be 93.88 or 100
});

test('parseAttendanceHtml captures official overall percentage from summary text or footer row', () => {
  const html = `
    <div>
      <h4>Overall Attendance : 95.89%</h4>
      <table>
        <tr>
          <th>Sl.No</th>
          <th>Course Code</th>
          <th>Course Title</th>
          <th>Conducted</th>
          <th>Present</th>
          <th>Absent</th>
          <th>OD</th>
          <th>Total %</th>
        </tr>
        <tr>
          <td>1</td>
          <td>MAT 279</td>
          <td>Stochastic Calculus</td>
          <td>18</td>
          <td>16</td>
          <td>0</td>
          <td>2</td>
          <td>95.89%</td>
        </tr>
        <tr>
          <td colspan="3">Total</td>
          <td>18</td>
          <td>16</td>
          <td>0</td>
          <td>2</td>
          <td>95.89%</td>
        </tr>
      </table>
    </div>
  `;
  const res = parseAttendanceHtml(html);
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0][7], 95.89);
  assert.equal(res.summary.officialPercentage, 95.89);
});

