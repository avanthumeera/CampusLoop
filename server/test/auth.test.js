import test from 'node:test';
import assert from 'node:assert/strict';
import { requireAuth, requireOrganizer, requireStudent } from '../src/middleware/auth.js';

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    clearCookie() { return this; },
  };
}

test('blocks organizer actions for student accounts', () => {
  const response = mockResponse();
  let advanced = false;
  requireOrganizer({ user: { role: 'student' } }, response, () => { advanced = true; });
  assert.equal(response.statusCode, 403);
  assert.equal(advanced, false);
});

test('blocks student-only actions for organizer accounts', () => {
  const response = mockResponse();
  let advanced = false;
  requireStudent({ user: { role: 'organizer' } }, response, () => { advanced = true; });
  assert.equal(response.statusCode, 403);
  assert.equal(advanced, false);
});

test('requires a session cookie for signed-in routes', async () => {
  const response = mockResponse();
  let advanced = false;
  await requireAuth({ cookies: {} }, response, () => { advanced = true; });
  assert.equal(response.statusCode, 401);
  assert.equal(advanced, false);
});
