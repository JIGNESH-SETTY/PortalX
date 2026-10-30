import { test } from 'node:test';
import assert from 'node:assert/strict';
import { srmSessionService } from '../../src/services/srmSession.service.js';

test('srmSessionService guarantees strict session isolation between users', async () => {
  const userA = srmSessionService.getOrCreateSession('user_a_session_key', 'AP25110010807');
  const userB = srmSessionService.getOrCreateSession('user_b_session_key', 'AP25110010808');

  assert.notEqual(userA.key, userB.key);
  assert.notEqual(userA.jar, userB.jar, 'Each user must possess an isolated tough-cookie jar instance');

  // Set cookie for User A
  await userA.jar.setCookie('JSESSIONID=SESSION_FOR_USER_A', 'https://student.srmap.edu.in');

  // Verify User A has the cookie
  const cookiesA = await userA.jar.getCookies('https://student.srmap.edu.in');
  assert.equal(cookiesA.length, 1);
  assert.equal(cookiesA[0].value, 'SESSION_FOR_USER_A');

  // Verify User B DOES NOT have User A's cookie (Zero cross-talk)
  const cookiesB = await userB.jar.getCookies('https://student.srmap.edu.in');
  assert.equal(cookiesB.length, 0, 'User B must not receive User A cookies');

  // Destroy User A
  srmSessionService.destroySession('user_a_session_key');
  assert.equal(srmSessionService.getSession('user_a_session_key'), null);

  // User B remains intact
  assert.ok(srmSessionService.getSession('user_b_session_key'));
});

