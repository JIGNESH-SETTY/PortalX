import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMarkAttendanceHtml } from '../../src/parsers/markAttendance.parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.join(__dirname, '..', 'fixtures', 'markAttendance.html');

test('parseMarkAttendanceHtml extracts day order, dynamic tokens, and today records', () => {
  const html = fs.readFileSync(fixturePath, 'utf-8');
  const data = parseMarkAttendanceHtml(html);

  assert.equal(data.dayOrder, 'Day 3');
  assert.equal(data.dynamiclatdata, '16.4632');
  assert.equal(data.dynamiclonxdata, '80.5078');

  assert.equal(data.todayAttendance.length, 2);
  assert.equal(data.todayAttendance[0].subject, 'CSE 204');
  assert.equal(data.todayAttendance[0].hour, '1');
  assert.equal(data.todayAttendance[0].status, 'Present');
});

test('parseMarkAttendanceHtml handles empty HTML gracefully', () => {
  const data = parseMarkAttendanceHtml('');
  assert.equal(data.dayOrder, '');
  assert.deepEqual(data.todayAttendance, []);
  assert.equal(data.dynamiclatdata, '');
});

