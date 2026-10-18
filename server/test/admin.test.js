import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const databasePath = join(tmpdir(), `campusloop-admin-test-${randomUUID()}.sqlite`);
process.env.CAMPUSLOOP_DB_PATH = databasePath;
process.env.ADMIN_EMAILS = 'trusted-admin@example.test';
process.env.JWT_SECRET = 'test-only-admin-secret-not-used-outside-this-test';

const { database } = await import('../src/database.js');
const { requireAdmin } = await import('../src/middleware/admin.js');
const { default: adminRoutes } = await import('../src/routes/admin.js');
const { createTeamAccountRequest, listPendingTeamAccountRequests } = await import('../src/models/TeamAccountRequest.js');
const { authenticateLogin } = await import('../src/routes/auth.js');
const bcrypt = (await import('bcryptjs')).default;

after(async () => { database.close(); await rm(databasePath, { force: true }); });

function responseDouble() {
  return {
    statusCode: 200, body: null, headers: {},
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    type(value) { this.contentType = value; return this; },
    send(data) { this.body = data; return this; },
  };
}

function handler(path, method) {
  const route = adminRoutes.stack.find((layer) => layer.route?.path === path)?.route;
  return route?.stack.find((layer) => layer.method === method)?.handle;
}

test('admin review authorization only accepts explicitly configured emails', () => {
  let allowed = false;
  requireAdmin({ user: { email: 'TRUSTED-ADMIN@example.test' } }, responseDouble(), () => { allowed = true; });
  assert.equal(allowed, true);
  allowed = false;
  const deniedResponse = responseDouble();
  requireAdmin({ user: { email: 'student@example.test' } }, deniedResponse, () => { allowed = true; });
  assert.equal(deniedResponse.statusCode, 403);
  assert.equal(allowed, false, 'a denied call must not proceed to the protected handler');
});

test('admin routes list logos privately and approve/reject only the selected pending request', async () => {
  const password = 'Team-admin-route-test-483!';
  const passwordHash = await bcrypt.hash(password, 4);
  const first = createTeamAccountRequest({ teamName: 'Selected Admin Route Team', category: 'Technical', subcategory: 'Software & Development', description: 'A selected team request for admin route validation.', teamEmail: 'selected-admin-team@example.test', representativeName: 'Selected Representative', representativeIdentity: '', passwordHash, websiteUrl: '', instagramUrl: '', logoData: `data:image/jpeg;base64,${Buffer.from([255, 216, 255, 9]).toString('base64')}` });
  const second = createTeamAccountRequest({ teamName: 'Other Admin Route Team', category: 'Cultural', subcategory: 'Music', description: 'Another team request that should remain independently pending.', teamEmail: 'other-admin-team@example.test', representativeName: 'Other Representative', representativeIdentity: '', passwordHash, websiteUrl: '', instagramUrl: '', logoData: null });

  const listResponse = responseDouble();
  handler('/team-requests', 'get')({}, listResponse);
  assert.deepEqual(listResponse.body.requests.map((item) => item.id).sort(), [first.id, second.id].sort());
  assert.equal('passwordHash' in listResponse.body.requests[0], false);

  const logoResponse = responseDouble();
  handler('/team-requests/:requestId/logo', 'get')({ params: { requestId: first.id } }, logoResponse);
  assert.deepEqual(logoResponse.body, Buffer.from([255, 216, 255, 9]));
  assert.equal(logoResponse.headers['Cache-Control'], 'private, no-store');

  const approveResponse = responseDouble();
  handler('/team-requests/:requestId/approve', 'post')({ params: { requestId: first.id } }, approveResponse);
  assert.equal(approveResponse.body.request.status, 'approved');
  assert.equal((await authenticateLogin(first.teamEmail, password, 'organizer')).role, 'organizer');
  assert.deepEqual(listPendingTeamAccountRequests().map((item) => item.id), [second.id]);

  const rejectResponse = responseDouble();
  handler('/team-requests/:requestId/reject', 'post')({ params: { requestId: second.id }, body: { reason: 'Reviewed by test.' } }, rejectResponse);
  assert.equal(rejectResponse.body.request.status, 'rejected');
  assert.deepEqual(listPendingTeamAccountRequests(), []);
});
