import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const databasePath = join(tmpdir(), `campusloop-auth-test-${randomUUID()}.sqlite`);
process.env.CAMPUSLOOP_DB_PATH = databasePath;
process.env.JWT_SECRET = 'test-only-secret-for-local-route-test';
process.env.ORGANIZER_EMAILS = 'organizer@example.test';

const { database } = await import('../src/database.js');
const { default: authRoutes } = await import('../src/routes/auth.js');
const { runTeamRequestReview } = await import('../scripts/review-team-requests.js');
const { authenticateLogin } = await import('../src/routes/auth.js');
const registerRoute = authRoutes.stack.find((layer) => layer.route?.path === '/register')?.route;
const registerHandler = registerRoute?.stack.find((layer) => layer.method === 'post')?.handle;
const teamRegisterRoute = authRoutes.stack.find((layer) => layer.route?.path === '/team-register')?.route;
const teamRegisterHandler = teamRegisterRoute?.stack.find((layer) => layer.method === 'post')?.handle;

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    cookie(name, value) { this.cookieName = name; this.cookieValue = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}

after(async () => {
  database.close();
  await rm(databasePath, { force: true });
});

test('public signup stays student-only even when the legacy allowlist contains the email', async () => {
  assert.equal(typeof registerHandler, 'function');
  const response = mockResponse();

  await registerHandler({ body: {
    name: 'Test Organizer', email: 'organizer@example.test', password: 'Test-only-password-901!',
  } }, response, (error) => { throw error; });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.user.role, 'student');
  assert.equal('passwordHash' in response.body.user, false);
  assert.equal(response.cookieName, 'campusloop_session');
  assert.ok(response.cookieValue);
  const saved = database.prepare('SELECT password_hash FROM users WHERE email = ?').get('organizer@example.test');
  assert.notEqual(saved.password_hash, 'Test-only-password-901!');
});

test('team signup stores a pending hashed request and does not issue a login cookie', async () => {
  const response = mockResponse();
  const body = {
    teamName: 'Test Robotics Team', category: 'Technical', subcategory: 'Core Engineering & Research',
    description: 'A student team working on robotics projects.', teamEmail: 'test-robotics@example.test',
    representativeName: 'Test Representative', representativeEmail: '', representativeIdentity: '',
    password: 'Private-test-password-836!', confirmPassword: 'Private-test-password-836!',
    websiteUrl: '', instagramUrl: '', logoData: '',
  };
  await teamRegisterHandler({ body }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.message, 'Your team account request has been submitted for review.');
  assert.equal(response.body.request.status, 'pending_approval');
  assert.equal(response.cookieName, undefined);
  assert.equal('passwordHash' in response.body.request, false);
  const saved = database.prepare('SELECT password_hash, status FROM team_account_requests WHERE team_email=?').get(body.teamEmail);
  assert.notEqual(saved.password_hash, body.password);
  assert.equal(saved.status, 'pending_approval');

  const duplicate = mockResponse();
  await teamRegisterHandler({ body }, duplicate, (error) => { throw error; });
  assert.equal(duplicate.statusCode, 409);
});

test('technical, cultural, and sports teams can submit original logos and gain login only after approval', async () => {
  const cases = [
    { category: 'Technical', subcategory: 'Software & Development', name: 'General Technical Test Team', email: 'technical-team@example.test', file: 'spider.jpeg', mime: 'image/jpeg' },
    { category: 'Cultural', subcategory: 'Music', name: 'General Cultural Test Team', email: 'cultural-team@example.test', file: 'e-cell-logo.png', mime: 'image/png' },
    { category: 'Sports', subcategory: 'Outdoor Sports', name: 'General Sports Test Team', email: 'sports-team@example.test', file: 'sportsfete.jpeg', mime: 'image/jpeg' },
  ];

  for (const entry of cases) {
    const logoBytes = await readFile(new URL(`../../client/public/team-logos/${entry.file}`, import.meta.url));
    const logoData = `data:${entry.mime};base64,${logoBytes.toString('base64')}`;
    const password = 'Private-test-password-921!';
    const response = mockResponse();
    await teamRegisterHandler({ body: {
      teamName: entry.name, category: entry.category, subcategory: entry.subcategory,
      description: `A valid ${entry.category.toLowerCase()} team application for route tests.`,
      teamEmail: entry.email, representativeName: 'Test Representative', representativeEmail: '',
      representativeIdentity: '', password, confirmPassword: password, websiteUrl: '', instagramUrl: '', logoData,
    } }, response, (error) => { throw error; });

    assert.equal(response.statusCode, 201, `${entry.category} submission should save`);
    assert.equal(response.body.request.status, 'pending_approval');
    assert.equal(response.cookieName, undefined, 'pending requests must not receive a login cookie');
    const pending = database.prepare('SELECT id, logo_data FROM team_account_requests WHERE team_email=?').get(entry.email);
    assert.equal(pending.logo_data, logoData, 'uploaded original image data must be retained unchanged');
    assert.equal(await authenticateLogin(entry.email, password, 'organizer'), null, 'pending representatives cannot log in');

    runTeamRequestReview('approve', pending.id);
    assert.ok(await authenticateLogin(entry.email, password, 'organizer'), 'approved representative can use Team Login');
    const savedLogo = database.prepare('SELECT logo_data FROM team_profiles WHERE organizer_id=(SELECT id FROM users WHERE email=?)').get(entry.email);
    assert.equal(savedLogo.logo_data, logoData, 'approved profile must retain original logo data');
  }
});

test('team registration rejects invalid category, mismatched passwords, and invalid logo content', async () => {
  const valid = {
    teamName: 'Invalid Input Test Team', category: 'Technical', subcategory: 'Software & Development',
    description: 'A valid description for negative route tests.', teamEmail: 'invalid-input-team@example.test',
    representativeName: 'Test Representative', password: 'Private-test-password-922!',
    confirmPassword: 'Private-test-password-922!', websiteUrl: '', instagramUrl: '', logoData: '',
  };
  for (const body of [
    { ...valid, category: 'Other' },
    { ...valid, category: 'Cultural', subcategory: 'Software & Development' },
    { ...valid, confirmPassword: 'different-password' },
    { ...valid, logoData: `data:image/jpeg;base64,${Buffer.from('not an image').toString('base64')}` },
  ]) {
    const response = mockResponse();
    await teamRegisterHandler({ body }, response, (error) => { throw error; });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.request, undefined);
  }
});
