import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const defaultPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/campusloop.sqlite');
const databasePath = resolve(process.env.CAMPUSLOOP_DB_PATH || defaultPath);
mkdirSync(dirname(databasePath), { recursive: true });

export const database = new DatabaseSync(databasePath);
database.exec('PRAGMA foreign_keys = ON;');
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('student', 'organizer')),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
    category TEXT NOT NULL, club TEXT NOT NULL, date TEXT NOT NULL, start_time TEXT NOT NULL,
    venue TEXT NOT NULL, registration_deadline TEXT NOT NULL,
    poster_data TEXT, announcement TEXT, reminder_text TEXT, registration_mode TEXT NOT NULL DEFAULT 'internal' CHECK (registration_mode IN ('internal', 'external')), registration_url TEXT, social_url TEXT,
    organizer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    publication_status TEXT NOT NULL CHECK (publication_status IN ('draft', 'published', 'cancelled')),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS events_status_date ON events(publication_status, date);
  CREATE INDEX IF NOT EXISTS events_organizer ON events(organizer_id);
  CREATE TABLE IF NOT EXISTS team_profiles (
    id TEXT PRIMARY KEY, organizer_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', subcategory TEXT NOT NULL DEFAULT '', logo_data TEXT,
    website_url TEXT NOT NULL DEFAULT '', instagram_url TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS team_account_requests (
    id TEXT PRIMARY KEY, team_name TEXT NOT NULL COLLATE NOCASE,
    category TEXT NOT NULL CHECK (category IN ('Technical', 'Cultural', 'Sports')),
    subcategory TEXT NOT NULL, description TEXT NOT NULL,
    team_email TEXT NOT NULL COLLATE NOCASE,
    representative_name TEXT NOT NULL, representative_identity TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL, website_url TEXT NOT NULL DEFAULT '', instagram_url TEXT NOT NULL DEFAULT '',
    logo_data TEXT, status TEXT NOT NULL CHECK (status IN ('pending_approval', 'approved', 'rejected')),
    rejection_reason TEXT NOT NULL DEFAULT '', reviewed_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS team_requests_status_created ON team_account_requests(status, created_at);
  CREATE UNIQUE INDEX IF NOT EXISTS team_requests_active_name ON team_account_requests(team_name COLLATE NOCASE) WHERE status IN ('pending_approval', 'approved');
  CREATE UNIQUE INDEX IF NOT EXISTS team_requests_active_email ON team_account_requests(team_email COLLATE NOCASE) WHERE status IN ('pending_approval', 'approved');
  CREATE TABLE IF NOT EXISTS team_bookmarks (
    id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL, created_at TEXT NOT NULL,
    UNIQUE(student_id, team_name)
  );
  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, created_at TEXT NOT NULL,
    UNIQUE(student_id, event_id)
  );
  CREATE TABLE IF NOT EXISTS registrations (
    id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    registered_at TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('registered', 'cancelled')),
    UNIQUE(student_id, event_id)
  );
`);

// Backfill a private profile for organizer accounts approved by older versions.
// Avoid a write lock on ordinary restarts when every approved account already
// has a profile (or there are no approved accounts yet).
const missingTeamProfile = database.prepare(`SELECT 1 FROM users WHERE role='organizer' AND NOT EXISTS (
  SELECT 1 FROM team_profiles WHERE team_profiles.organizer_id=users.id
) LIMIT 1`).get();
if (missingTeamProfile) database.exec(`INSERT INTO team_profiles (id, organizer_id, name, description, logo_data, website_url, instagram_url, created_at, updated_at)
  SELECT lower(hex(randomblob(16))), id, name, '', NULL, '', '', created_at, updated_at
  FROM users WHERE role='organizer' AND NOT EXISTS (
    SELECT 1 FROM team_profiles WHERE team_profiles.organizer_id=users.id
  )`);

// Add optional announcement fields to databases created by earlier CampusLoop versions.
const eventColumns = new Set(database.prepare('PRAGMA table_info(events)').all().map((column) => column.name));
for (const [name, type] of [
  ['poster_data', 'TEXT'], ['announcement', 'TEXT'], ['registration_url', 'TEXT'], ['social_url', 'TEXT'],
  ['reminder_text', 'TEXT'],
]) {
  if (!eventColumns.has(name)) database.exec(`ALTER TABLE events ADD COLUMN ${name} ${type}`);
}

const teamProfileColumns = new Set(database.prepare('PRAGMA table_info(team_profiles)').all().map((column) => column.name));
for (const [name, type] of [['category', "TEXT NOT NULL DEFAULT ''"], ['subcategory', "TEXT NOT NULL DEFAULT ''"]]) {
  if (!teamProfileColumns.has(name)) database.exec(`ALTER TABLE team_profiles ADD COLUMN ${name} ${type}`);
}

if (!eventColumns.has('registration_mode')) {
  database.exec("ALTER TABLE events ADD COLUMN registration_mode TEXT NOT NULL DEFAULT 'internal' CHECK (registration_mode IN ('internal', 'external'))");
  database.exec("UPDATE events SET registration_mode = 'external' WHERE registration_url IS NOT NULL AND trim(registration_url) != ''");
}

export function isDatabaseAvailable() {
  try { database.prepare('SELECT 1').get(); return true; }
  catch { return false; }
}
