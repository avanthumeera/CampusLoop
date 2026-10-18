import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const databasePath = join(tmpdir(), `campusloop-team-accounts-${randomUUID()}.sqlite`);
process.env.CAMPUSLOOP_DB_PATH = databasePath;
const { database } = await import('../src/database.js');
const { createUser } = await import('../src/models/User.js');
const { ensureTeamProfile, getTeamProfile, updateTeamProfile } = await import('../src/models/TeamProfile.js');
const { addTeamBookmark, listTeamBookmarks, removeTeamBookmark } = await import('../src/models/TeamBookmark.js');
const { createTeamAccountRequest, listPendingTeamAccountRequests, reviewTeamAccountRequest } = await import('../src/models/TeamAccountRequest.js');
const { runTeamRequestReview } = await import('../scripts/review-team-requests.js');
const { validateProfile } = await import('../src/routes/team.js');
const { authenticateLogin, loginFailureMessage, validateTeamRegistration } = await import('../src/routes/auth.js');
const bcrypt = (await import('bcryptjs')).default;

after(async () => { database.close(); await rm(databasePath, { force: true }); });

test('team profile validation requires safe URLs and bounds user-provided fields', () => {
  assert.equal(typeof validateProfile({ name: 'Team', websiteUrl: 'http://example.org' }), 'string');
  assert.equal(typeof validateProfile({ name: 'Team', instagramUrl: 'https://example.org/team' }), 'string');
  assert.equal(typeof validateProfile({ name: 'T', websiteUrl: '' }), 'string');
  const valid = validateProfile({ name: 'Team Name', description: 'We build things.', websiteUrl: 'https://example.org', instagramUrl: 'https://www.instagram.com/example/' });
  assert.equal(valid.name, 'Team Name');
  assert.equal(valid.instagramUrl, 'https://www.instagram.com/example/');
});

test('approved accounts get an isolated team profile and student team bookmarks are unique', () => {
  const representative = createUser({ name: 'Representative', email: 'rep@example.test', passwordHash: 'test-hash', role: 'organizer' });
  const otherRepresentative = createUser({ name: 'Other Rep', email: 'other@example.test', passwordHash: 'test-hash', role: 'organizer' });
  const student = createUser({ name: 'Student', email: 'student@example.test', passwordHash: 'test-hash', role: 'student' });
  ensureTeamProfile(representative.id, 'Original account name');
  ensureTeamProfile(otherRepresentative.id, 'Other account name');
  assert.equal(getTeamProfile(representative.id).name, 'Original account name');
  updateTeamProfile(representative.id, { name: 'Approved Team', description: 'Team details', websiteUrl: '', instagramUrl: '', logoData: undefined, removeLogo: false });
  assert.equal(getTeamProfile(representative.id).name, 'Approved Team');
  assert.equal(getTeamProfile(otherRepresentative.id).name, 'Other account name');
  addTeamBookmark(student.id, 'Delta Force');
  assert.equal(listTeamBookmarks(student.id)[0].teamName, 'Delta Force');
  assert.throws(() => addTeamBookmark(student.id, 'Delta Force'), /UNIQUE constraint failed/);
  assert.equal(removeTeamBookmark(student.id, 'Delta Force'), true);
  assert.deepEqual(listTeamBookmarks(student.id), []);
});

test('student and team login paths accept only their approved database role', async () => {
  const password = 'Test-only-account-password-103!';
  const passwordHash = await bcrypt.hash(password, 4);
  const student = createUser({ name: 'Student Login', email: 'student-login@example.test', passwordHash, role: 'student' });
  const team = createUser({ name: 'Team Login', email: 'team-login@example.test', passwordHash, role: 'organizer' });
  assert.equal((await authenticateLogin(student.email, password, 'student')).id, student.id);
  assert.equal((await authenticateLogin(team.email, password, 'organizer')).id, team.id);
  assert.equal(await authenticateLogin(team.email, password, 'student'), null);
  assert.equal(await authenticateLogin(student.email, password, 'organizer'), null);
  assert.equal(await authenticateLogin(student.email, 'wrong-password', 'student'), null);
  assert.match(loginFailureMessage('organizer'), /administrator approves team access/);
  assert.match(loginFailureMessage('student'), /use Team Login/);
});

test('team registration validates inputs and does not create login access before administrator approval', async () => {
  const password = 'Team-test-password-384!';
  const fields = {
    teamName: 'Campus Robotics Test Team', category: 'Technical', subcategory: 'Core Engineering & Research',
    description: 'A student team exploring robotics and embedded systems.', teamEmail: 'robotics-request@example.test',
    representativeName: 'Team Representative', representativeEmail: 'rep@nitt.example.test',
    representativeIdentity: 'Provided for admin review', password, confirmPassword: password,
    websiteUrl: 'https://example.test/robotics', instagramUrl: '',
    logoData: `data:image/jpeg;base64,${Buffer.from([255, 216, 255, 0, 1]).toString('base64')}`,
  };
  assert.equal(typeof validateTeamRegistration({ ...fields, confirmPassword: 'different-password' }), 'string');
  assert.equal(typeof validateTeamRegistration({ ...fields, websiteUrl: 'http://example.test' }), 'string');
  assert.equal(typeof validateTeamRegistration({ ...fields, subcategory: 'Music' }), 'string');
  const validated = validateTeamRegistration(fields);
  assert.equal(validated.teamEmail, fields.teamEmail);
  assert.equal(validated.representativeIdentity, 'rep@nitt.example.test · Provided for admin review');
  const passwordHash = await bcrypt.hash(validated.password, 4);
  const request = createTeamAccountRequest({ ...validated, passwordHash });
  assert.equal(request.status, 'pending_approval');
  assert.equal(listPendingTeamAccountRequests().some((item) => item.id === request.id), true);
  assert.equal(await authenticateLogin(fields.teamEmail, password, 'organizer'), null);
  assert.throws(() => createTeamAccountRequest({ ...validated, passwordHash }), /UNIQUE constraint failed/);

  const listed = runTeamRequestReview('list');
  assert.equal(listed.some((item) => item.id === request.id), true);
  runTeamRequestReview('approve', request.id);
  const approved = await authenticateLogin(fields.teamEmail, password, 'organizer');
  assert.equal(approved.name, fields.representativeName);
  assert.equal(getTeamProfile(approved.id).name, fields.teamName);
  assert.equal(getTeamProfile(approved.id).category, 'Technical');
  assert.equal((await import('../src/models/TeamProfile.js')).getTeamLogo(approved.id), fields.logoData);
  assert.throws(() => reviewTeamAccountRequest(request.id, 'approve'), /No pending team request/);
});

test('administrator rejection leaves no login account and permits a corrected resubmission', async () => {
  const requestValues = {
    teamName: 'Rejected Test Arts Team', category: 'Cultural', subcategory: 'Music',
    description: 'A test request that will be rejected.', teamEmail: 'rejected-team@example.test',
    representativeName: 'Test Representative', representativeIdentity: '', passwordHash: 'unused-hash',
    websiteUrl: '', instagramUrl: '', logoData: null,
  };
  const rejected = createTeamAccountRequest(requestValues);
  assert.equal(runTeamRequestReview('reject', rejected.id, 'Could not confirm team affiliation.').status, 'rejected');
  assert.equal(await authenticateLogin(requestValues.teamEmail, 'unused', 'organizer'), null);
  assert.equal(database.prepare('SELECT password_hash FROM team_account_requests WHERE id=?').get(rejected.id).password_hash, '');
  const resubmitted = createTeamAccountRequest(requestValues);
  assert.equal(resubmitted.status, 'pending_approval');
});
