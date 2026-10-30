import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseProfileHtml } from '../../src/parsers/profile.parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.join(__dirname, '..', 'fixtures', 'profile.html');

test('parseProfileHtml correctly extracts all fields from realistic SRM HTML', () => {
  const html = fs.readFileSync(fixturePath, 'utf-8');
  const profile = parseProfileHtml(html);

  assert.equal(profile.name, 'S JIGNESH');
  assert.equal(profile.studentId, 'AP25110010807');
  assert.equal(profile.regNo, 'AP25110010807');
  assert.equal(profile.institution, 'School of Engineering and Sciences (College)');
  assert.equal(profile.semester, 'III SEMESTER');
  assert.equal(profile.program, 'B.Tech.-Computer Science and Engineering [UG - Full Time]');
  assert.equal(profile.section, 'A');
  assert.equal(profile.programSection, 'B.Tech.-Computer Science and Engineering [UG - Full Time] / A');
  assert.equal(profile.dob, '13-Dec-2007');
  assert.equal(profile.gender, 'Male');
  assert.equal(profile.dobGender, '13-Dec-2007 / Male');
  assert.equal(profile.phone, '9100715947');
  assert.equal(profile.phoneVerified, true);
  assert.equal(profile.email, 'jignesh_s@srmap.edu.in');
  assert.equal(profile.father, 'S GURUNADHAM');
  assert.equal(profile.mother, 'S YASODA');
  assert.equal(profile.parentNames, 'S GURUNADHAM / S YASODA');
});

test('parseProfileHtml handles empty or malformed HTML gracefully without throwing', () => {
  const profile = parseProfileHtml('');
  assert.equal(profile.name, '');
  assert.equal(profile.studentId, '');
  assert.equal(profile.email, '');

  const nullProfile = parseProfileHtml(null);
  assert.equal(nullProfile.name, '');
});

test('parseProfileHtml handles missing optional fields without fabricating data', () => {
  const html = '<table><tr><td>Name:</td><td>ALICE</td></tr></table>';
  const profile = parseProfileHtml(html);

  assert.equal(profile.name, 'ALICE');
  assert.equal(profile.specialization, '');
  assert.equal(profile.phone, '');
  assert.equal(profile.phoneVerified, false);
});

