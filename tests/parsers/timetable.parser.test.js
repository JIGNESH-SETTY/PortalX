import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTimetableHtml } from '../../src/parsers/timetable.parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.join(__dirname, '..', 'fixtures', 'timetable.html');

test('parseTimetableHtml correctly extracts weekly schedule grid and subject list', () => {
  const html = fs.readFileSync(fixturePath, 'utf-8');
  const timetable = parseTimetableHtml(html);

  assert.ok(timetable.days);
  assert.equal(timetable.days.Mon.length, 8);
  assert.equal(timetable.days.Mon[0], 'CSE 213:S 404');
  assert.equal(timetable.days.Mon[1], 'SEC 203:S 404');
  assert.equal(timetable.days.Mon[4], 0, 'Empty slot with "-" should parse as 0');
  assert.equal(timetable.days.Mon[5], 'CSE 202:C 804');
  assert.equal(timetable.days.Mon[7], 'MAT 279:C 504');

  // Verify NIL and blank cells parse as 0
  assert.equal(timetable.days.Tue[4], 0, 'Slot with NIL should parse as 0');
  assert.equal(timetable.days.Tue[5], 0, 'Blank cell should parse as 0');

  // Verify FREE keyword parses as 0
  assert.equal(timetable.days.Wed[1], 0, 'Slot with FREE should parse as 0');

  // Verify Saturday is all free slots
  assert.deepEqual(timetable.days.Sat, [0, 0, 0, 0, 0, 0, 0, 0]);

  // Verify subjects list
  assert.equal(timetable.subjects.length, 3);
  const cse202 = timetable.subjects.find(s => s.code === 'CSE 202');
  assert.ok(cse202);
  assert.equal(cse202.name, 'OBJECT ORIENTED PROGRAMMING WITH C++');
  assert.equal(cse202.ltpc, '3-0-1-4');
  assert.equal(cse202.faculty.length, 2);
  assert.equal(cse202.faculty[0], 'Dr. Lipismita Panigrahi (25065)');
  assert.deepEqual(cse202.rooms, ['C 804', 'S 404']);
});

test('parseTimetableHtml handles malformed or empty HTML safely', () => {
  const empty = parseTimetableHtml('');
  assert.deepEqual(empty.days.Mon, [0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(empty.subjects, []);
});

