import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';

const databasePath = join(tmpdir(), `campusloop-test-${randomUUID()}.sqlite`);
process.env.CAMPUSLOOP_DB_PATH = databasePath;
process.env.PORT = '0';
process.env.JWT_SECRET = 'test-only-signing-secret-that-is-not-used-outside-this-test';
// Keep the legacy setting populated to prove public registration ignores it.
process.env.ORGANIZER_EMAILS = 'organizer@example.test';
process.env.ADMIN_EMAILS = 'campusloop-admin@example.test';
process.env.NODE_ENV = 'test';

const { app } = await import('../src/index.js');
const { database } = await import('../src/database.js');
const { createUser } = await import('../src/models/User.js');
const bcrypt = (await import('bcryptjs')).default;
let server;
let api;

before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  api = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  database.close();
  await rm(databasePath, { force: true });
});

async function request(path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  const session = response.headers.get('set-cookie')?.split(';')[0];
  return { status: response.status, data, cookie: session || cookie };
}

test('student and organizer can complete the core campus event journeys safely', async (context) => {
 try {
  const health = await request('/health');
  assert.equal(health.status, 200);
  assert.equal(health.data.database, 'connected');

  const organizerSignup = await request('/auth/register', { method: 'POST', body: {
    name: 'Test Organizer', email: 'organizer@example.test', password: 'Organizer-test-Password-984!',
  } });
  assert.equal(organizerSignup.status, 201);
  assert.equal(organizerSignup.data.user.role, 'student');
  assert.equal('passwordHash' in organizerSignup.data.user, false);

  const unapprovedOrganizerAction = await request('/events', { method: 'POST', body: {
    title: 'CampusLoop Verification Event', description: 'A verification event with enough detail to pass form validation.',
    category: 'Technology', club: 'Verification Club', date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    startTime: '18:30', venue: 'Main Hall', registrationDeadline: new Date(Date.now() + 60_000).toISOString(),
  }, cookie: organizerSignup.cookie });
  assert.equal(unapprovedOrganizerAction.status, 403);

  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const { resolve } = await import('node:path');
  const approvalScript = resolve(fileURLToPath(new URL('..', import.meta.url)), 'scripts/manage-organizer.js');
  const approval = spawnSync(process.execPath, [approvalScript, 'approve', 'organizer@example.test'], {
    encoding: 'utf8', env: { ...process.env, CAMPUSLOOP_DB_PATH: databasePath },
  });
  assert.equal(approval.status, 0, approval.stderr);
  assert.match(approval.stdout, /Organizer access approved/);

  const badLogin = await request('/auth/login', { method: 'POST', body: { email: 'organizer@example.test', password: 'incorrect-password' } });
  assert.equal(badLogin.status, 401);
  const studentLoginForOrganizer = await request('/auth/login', { method: 'POST', body: { email: 'organizer@example.test', password: 'Organizer-test-Password-984!' } });
  assert.equal(studentLoginForOrganizer.status, 401);
  const organizerLogin = await request('/auth/team-login', { method: 'POST', body: { email: 'organizer@example.test', password: 'Organizer-test-Password-984!' } });
  assert.equal(organizerLogin.status, 200);

  const studentSignup = await request('/auth/register', { method: 'POST', body: {
    name: 'Test Student', email: 'student@example.test', password: 'Student-test-Password-984!',
  } });
  assert.equal(studentSignup.status, 201);
  assert.equal(studentSignup.data.user.role, 'student');
  const duplicateSignup = await request('/auth/register', { method: 'POST', body: {
    name: 'Test Student', email: 'student@example.test', password: 'Student-test-Password-984!',
  } });
  assert.equal(duplicateSignup.status, 409);

  const eventInput = {
    title: 'CampusLoop Verification Event',
    description: 'A verification event with enough detail to pass form validation.',
    category: 'Technology', club: 'Verification Club',
    date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    startTime: '18:30', venue: 'Main Hall', registrationMode: 'internal',
    registrationDeadline: new Date(Date.now() + 60_000).toISOString(),
  };
  const forbidden = await request('/events', { method: 'POST', body: eventInput, cookie: studentSignup.cookie });
  assert.equal(forbidden.status, 403);

  const created = await request('/events', { method: 'POST', body: eventInput, cookie: organizerLogin.cookie });
  assert.equal(created.status, 201);
  const eventId = created.data.event._id;
  const feed = await request('/events?search=Verification&category=Technology&club=Verification%20Club');
  assert.equal(feed.data.events.length, 1);
  assert.equal((await request(`/events/${eventId}`)).data.event.organizer.name, 'Test Organizer');

  const externalEvent = await request('/events', { method: 'POST', cookie: organizerLogin.cookie, body: {
    ...eventInput, title: 'External form verification event', registrationMode: 'external', registrationUrl: 'https://forms.example.test/campus-event',
  } });
  assert.equal(externalEvent.status, 201);
  assert.equal(externalEvent.data.event.registrationMode, 'external');
  const externalSignup = await request(`/registrations/${externalEvent.data.event._id}`, { method: 'POST', cookie: studentSignup.cookie });
  assert.equal(externalSignup.status, 409);
  assert.match(externalSignup.data.error, /external registration form/);

  assert.equal((await request(`/bookmarks/${eventId}`, { method: 'POST', cookie: studentSignup.cookie })).status, 201);
  assert.equal((await request(`/bookmarks/${eventId}`, { method: 'POST', cookie: studentSignup.cookie })).status, 409);
  assert.equal((await request('/bookmarks', { cookie: studentSignup.cookie })).data.bookmarks.length, 1);
  assert.equal((await request(`/bookmarks/${eventId}`, { method: 'DELETE', cookie: studentSignup.cookie })).status, 200);

  assert.equal((await request(`/registrations/${eventId}`, { method: 'POST', cookie: studentSignup.cookie })).status, 201);
  assert.equal((await request(`/registrations/${eventId}`, { method: 'POST', cookie: studentSignup.cookie })).status, 409);
  assert.equal((await request('/registrations', { cookie: studentSignup.cookie })).data.registrations[0].status, 'registered');
  assert.equal((await request(`/events/${eventId}/registrations`, { cookie: organizerLogin.cookie })).data.registrations.length, 1);

  const edited = await request(`/events/${eventId}`, { method: 'PUT', cookie: organizerLogin.cookie, body: { ...eventInput, venue: 'Updated Main Hall' } });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.event.venue, 'Updated Main Hall');

  const lateEvent = await request('/events', { method: 'POST', cookie: organizerLogin.cookie, body: {
    ...eventInput, title: 'Deadline Verification Event', registrationDeadline: new Date(Date.now() + 1000).toISOString(),
  } });
  assert.equal(lateEvent.status, 201);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const lateRegistration = await request(`/registrations/${lateEvent.data.event._id}`, { method: 'POST', cookie: studentSignup.cookie });
  assert.equal(lateRegistration.status, 400);

  assert.equal((await request('/events/not-a-valid-id')).status, 404);

  const revocation = spawnSync(process.execPath, [approvalScript, 'revoke', 'organizer@example.test'], {
    encoding: 'utf8', env: { ...process.env, CAMPUSLOOP_DB_PATH: databasePath },
  });
  assert.equal(revocation.status, 0, revocation.stderr);
  assert.match(revocation.stdout, /Organizer access revoked/);
  assert.equal((await request('/events/managed', { cookie: organizerLogin.cookie })).status, 403);
 } catch (error) {
  if (error.cause?.code === 'EACCES' || error.cause?.code === 'EPERM') {
    context.skip('This environment blocks local loopback HTTP connections; run npm test on the development machine to execute this API journey.');
    return;
  }
  throw error;
 }
});

test('only the configured admin can review one selected team request and approve team access', async (context) => {
 try {
  const adminEmail = 'campusloop-admin@example.test';
  const adminPassword = 'Admin-test-password-482!';
  const publicClaim = await request('/auth/register', { method: 'POST', body: { name: 'Claimed Admin', email: adminEmail, password: adminPassword } });
  assert.equal(publicClaim.status, 403, 'public signup cannot create the configured administrator account');
  createUser({ name: 'CampusLoop Admin', email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 4), role: 'student' });

  assert.equal((await request('/admin/team-requests')).status, 401);
  const student = await request('/auth/register', { method: 'POST', body: { name: 'Review Test Student', email: 'review-student@example.test', password: 'Student-test-password-472!' } });
  assert.equal((await request('/admin/team-requests', { cookie: student.cookie })).status, 403);
  const adminLogin = await request('/auth/login', { method: 'POST', body: { email: adminEmail, password: adminPassword } });
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.data.user.isAdmin, true);

  const logo = await readFile(new URL('../../client/public/team-logos/sportsfete.jpeg', import.meta.url));
  const first = await request('/auth/team-register', { method: 'POST', body: {
    teamName: 'Admin Review Selected Team', category: 'Sports', subcategory: 'Outdoor Sports',
    description: 'An integration-test application reviewed through the secured admin API.',
    teamEmail: 'selected-team@example.test', representativeName: 'Selected Representative',
    password: 'Selected-team-password-388!', confirmPassword: 'Selected-team-password-388!',
    websiteUrl: '', instagramUrl: '', logoData: `data:image/jpeg;base64,${logo.toString('base64')}`,
  } });
  const second = await request('/auth/team-register', { method: 'POST', body: {
    teamName: 'Admin Review Other Team', category: 'Cultural', subcategory: 'Music',
    description: 'A second integration-test application left pending during approval.',
    teamEmail: 'other-team@example.test', representativeName: 'Other Representative',
    password: 'Other-team-password-488!', confirmPassword: 'Other-team-password-488!',
    websiteUrl: '', instagramUrl: '', logoData: '',
  } });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);

  const pending = await request('/admin/team-requests', { cookie: adminLogin.cookie });
  assert.equal(pending.status, 200);
  assert.deepEqual(pending.data.requests.map((item) => item.id).sort(), [first.data.request.id, second.data.request.id].sort());
  const preview = await fetch(`${api}/admin/team-requests/${first.data.request.id}/logo`, { headers: { cookie: adminLogin.cookie } });
  assert.equal(preview.status, 200);
  assert.deepEqual(Buffer.from(await preview.arrayBuffer()), logo);

  const approved = await request(`/admin/team-requests/${first.data.request.id}/approve`, { method: 'POST', cookie: adminLogin.cookie, body: {} });
  assert.equal(approved.status, 200);
  assert.equal(approved.data.request.status, 'approved');
  const remaining = await request('/admin/team-requests', { cookie: adminLogin.cookie });
  assert.deepEqual(remaining.data.requests.map((item) => item.id), [second.data.request.id], 'approval affects only the selected request');
  const teamLogin = await request('/auth/team-login', { method: 'POST', body: { email: 'selected-team@example.test', password: 'Selected-team-password-388!' } });
  assert.equal(teamLogin.status, 200);
  assert.equal(teamLogin.data.user.role, 'organizer');
  const denied = await request(`/admin/team-requests/${second.data.request.id}/reject`, { method: 'POST', cookie: student.cookie, body: { reason: 'not authorized' } });
  assert.equal(denied.status, 403);
  assert.equal((await request(`/admin/team-requests/${second.data.request.id}/reject`, { method: 'POST', cookie: adminLogin.cookie, body: { reason: 'Test cleanup' } })).status, 200);
 } catch (error) {
  if (error.cause?.code === 'EACCES' || error.cause?.code === 'EPERM') {
    context.skip('This environment blocks local loopback HTTP connections; run this API journey on the development machine.');
    return;
  }
  throw error;
 }
});
