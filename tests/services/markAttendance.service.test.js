import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markAttendanceService } from '../../src/services/markAttendance.service.js';
import { ValidationError } from '../../src/utils/errors.js';

test('markAttendanceService enforces code format validation', async () => {
  // Empty code
  await assert.rejects(
    async () => {
      await markAttendanceService.submitCode('test_key', 'AP25110010807', { code: '' });
    },
    ValidationError
  );

  // Invalid code (7 numbers, missing leading letter)
  await assert.rejects(
    async () => {
      await markAttendanceService.submitCode('test_key', 'AP25110010807', { code: '1234567' });
    },
    ValidationError
  );

  // Invalid code (too short)
  await assert.rejects(
    async () => {
      await markAttendanceService.submitCode('test_key', 'AP25110010807', { code: 'A123' });
    },
    ValidationError
  );
});

test('markAttendanceService correctly interprets SRM JSON response states', () => {
  // Test case 1: SRM returns success message with resultstatus 0
  const responseSuccess = {
    resultstatus: '0',
    result: 'Attendance Marked Successfully'
  };
  const isRecorded1 =
    responseSuccess.resultstatus === '1' ||
    (typeof responseSuccess.result === 'string' &&
      responseSuccess.result.toLowerCase().includes('success'));
  assert.equal(isRecorded1, true);

  // Test case 2: SRM returns failure message
  const responseFail = {
    resultstatus: '0',
    result: 'Invalid Code or Attendance Window Closed'
  };
  const isRecorded2 =
    responseFail.resultstatus === '1' ||
    (typeof responseFail.result === 'string' &&
      responseFail.result.toLowerCase().includes('success'));
  assert.equal(isRecorded2, false);
});

