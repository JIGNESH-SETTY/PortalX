import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMarksHtml } from '../../src/parsers/marks.parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.join(__dirname, '..', 'fixtures', 'marks.html');

test('parseMarksHtml extracts summary marks and preserves null for unentered assessments', () => {
  const html = fs.readFileSync(fixturePath, 'utf-8');
  const marks = parseMarksHtml(html);

  assert.equal(marks.rows.length, 4);
  assert.equal(marks.subjects.length, 4);

  // CSE 202: 18.80 / 50
  assert.equal(marks.rows[0][0], 'CSE 202');
  assert.equal(marks.rows[0][1], 18.80);
  assert.equal(marks.rows[0][2], 50);

  // CSE 207: marks not yet entered ('--')
  const cse207 = marks.subjects.find(s => s.code === 'CSE 207');
  assert.ok(cse207);
  assert.equal(cse207.obtained, null, 'Unentered marks must remain null instead of fabricating 0');
  assert.equal(cse207.isPublished, false);

  // Check detailed components for CSE 202
  const cse202 = marks.subjects.find(s => s.code === 'CSE 202');
  assert.ok(cse202);
  assert.equal(cse202.components.length, 3);

  const cla1 = cse202.components[0];
  assert.equal(cla1.name, 'CLA 1');
  assert.equal(cla1.conducted, 18.00);
  assert.equal(cla1.converted, 9.00);

  const mid1 = cse202.components[1];
  assert.equal(mid1.name, 'Mid Semester Exam I');
  assert.equal(mid1.conducted, 39.20);
  assert.equal(mid1.max, 50);

  // CLA 2 has '-' for conducted and converted marks
  const cla2 = cse202.components[2];
  assert.equal(cla2.name, 'CLA 2');
  assert.equal(cla2.conducted, null, 'Blank conducted mark should be null');
  assert.equal(cla2.converted, null, 'Blank converted mark should be null');
});

test('parseMarksHtml handles empty HTML gracefully', () => {
  const marks = parseMarksHtml('');
  assert.deepEqual(marks.rows, []);
  assert.deepEqual(marks.subjects, []);
});

