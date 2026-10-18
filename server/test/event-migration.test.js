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
const databasePath = join(tmpdir(), `campusloop-event-migration-${randomUUID()}.sqlite`);

test('existing events migrate to internal or external registration without losing their links', async () => {
  const legacy = new DatabaseSync(databasePath);
  legacy.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('student', 'organizer')),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE events (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
      category TEXT NOT NULL, club TEXT NOT NULL, date TEXT NOT NULL, start_time TEXT NOT NULL,
      venue TEXT NOT NULL, registration_deadline TEXT NOT NULL,
      poster_data TEXT, announcement TEXT, reminder_text TEXT, registration_url TEXT, social_url TEXT,
      organizer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      publication_status TEXT NOT NULL CHECK (publication_status IN ('draft', 'published', 'cancelled')),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `);
  legacy.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    'organizer', 'Test Organizer', 'organizer@example.test', 'test-hash', 'organizer', new Date().toISOString(), new Date().toISOString(),
  );
  const insert = legacy.prepare(`INSERT INTO events (
    id, title, description, category, club, date, start_time, venue, registration_deadline,
    registration_url, social_url, organizer_id, publication_status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)`);
  const now = new Date().toISOString();
  insert.run('internal-event', 'Internal event', 'Long enough description for this legacy event.', 'Technology', 'Test Club', '2099-01-01', '18:00', 'Main Hall', '2099-01-01T18:00:00.000Z', null, null, 'organizer', now, now);
  insert.run('external-event', 'External event', 'Long enough description for this legacy event.', 'Technology', 'Test Club', '2099-01-02', '18:00', 'Main Hall', '2099-01-02T18:00:00.000Z', 'https://forms.example.test/event', null, 'organizer', now, now);
  legacy.close();

  try {
    const migration = spawnSync(process.execPath, ['--input-type=module', '-e', "const { database } = await import('./src/database.js'); database.close();"], {
      cwd: serverDirectory,
      encoding: 'utf8',
      env: { ...process.env, CAMPUSLOOP_DB_PATH: databasePath },
    });
    assert.equal(migration.status, 0, migration.stderr);

    const migrated = new DatabaseSync(databasePath);
    const rows = migrated.prepare('SELECT id, registration_mode, registration_url FROM events ORDER BY id').all();
    assert.deepEqual(rows.map(({ id, registration_mode }) => [id, registration_mode]), [
      ['external-event', 'external'],
      ['internal-event', 'internal'],
    ]);
    assert.equal(rows[0].registration_url, 'https://forms.example.test/event');
    migrated.close();
  } finally {
    await rm(databasePath, { force: true });
  }
});
