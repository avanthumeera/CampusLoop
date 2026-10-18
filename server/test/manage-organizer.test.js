import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = resolve(serverDirectory, 'scripts/manage-organizer.js');
const databasePath = join(tmpdir(), `campusloop-organizer-test-${randomUUID()}.sqlite`);
const email = 'club-organizer@example.test';

function runCommand(action) {
  return spawnSync(process.execPath, [script, action, email], {
    cwd: serverDirectory,
    encoding: 'utf8',
    env: { ...process.env, CAMPUSLOOP_DB_PATH: databasePath },
  });
}

test('local organizer approval and revocation update an existing account role', async (context) => {
  const database = new DatabaseSync(databasePath);
  database.exec(`CREATE TABLE users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('student', 'organizer')),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`);
  database.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    'test-user', 'Test Club Organizer', email, 'not-a-real-password-hash', 'student', new Date().toISOString(), new Date().toISOString(),
  );
  database.close();

  try {
    const approved = runCommand('approve');
    assert.equal(approved.status, 0, approved.stderr);
    assert.match(approved.stdout, /Organizer access approved/);
    let check = new DatabaseSync(databasePath);
    assert.equal(check.prepare('SELECT role FROM users WHERE email = ?').get(email).role, 'organizer');
    assert.equal(check.prepare('SELECT name FROM team_profiles WHERE organizer_id = ?').get('test-user').name, 'Test Club Organizer');
    check.close();

    const revoked = runCommand('revoke');
    assert.equal(revoked.status, 0, revoked.stderr);
    assert.match(revoked.stdout, /Organizer access revoked/);
    check = new DatabaseSync(databasePath);
    assert.equal(check.prepare('SELECT role FROM users WHERE email = ?').get(email).role, 'student');
    check.close();

    const missing = spawnSync(process.execPath, [script, 'approve', 'missing@example.test'], {
      cwd: serverDirectory,
      encoding: 'utf8',
      env: { ...process.env, CAMPUSLOOP_DB_PATH: databasePath },
    });
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /No account was found/);
  } finally {
    await rm(databasePath, { force: true });
  }
});
