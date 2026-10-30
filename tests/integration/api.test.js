import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';

describe('PortalX Express API Integration Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = createApp();
    await new Promise((resolve) => {
      // Use port 0 to bind to any available ephemeral port for test isolation
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  test('GET /api/health returns operational status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.data.status, 'healthy');
  });

  test('Protected routes reject unauthenticated requests with 401', async () => {
    const endpoints = [
      '/api/student/profile',
      '/api/timetable',
      '/api/attendance',
      '/api/marks',
      '/api/mark-attendance'
    ];

    for (const endpoint of endpoints) {
      const res = await fetch(`${baseUrl}${endpoint}`);
      assert.equal(res.status, 401, `Endpoint ${endpoint} must require authentication`);

      const json = await res.json();
      assert.equal(json.ok, false);
      assert.equal(json.code, 'AUTHENTICATION_REQUIRED');
    }
  });

  test('POST /api/auth/login validates required fields', async () => {
    // Missing body / empty
    const res1 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res1.status, 400);

    // Invalid Register Number pattern (does not start with AP)
    const res2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '1234567890123', password: 'secret' })
    });
    assert.equal(res2.status, 400);
  });

  test('GET /api/unknown-endpoint returns 404 JSON', async () => {
    const res = await fetch(`${baseUrl}/api/non-existent-resource`);
    assert.equal(res.status, 404);

    const json = await res.json();
    assert.equal(json.ok, false);
    assert.equal(json.code, 'ROUTE_NOT_FOUND');
  });
});

