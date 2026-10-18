import { randomUUID } from 'node:crypto';
import { database } from '../database.js';

const publicRequest = (row) => row && ({
  id: row.id, teamName: row.team_name, category: row.category,
  subcategory: row.subcategory, teamEmail: row.team_email,
  representativeName: row.representative_name,
  status: row.status, createdAt: row.created_at,
});

export function createTeamAccountRequest(values) {
  const activeTeam = database.prepare(`SELECT 1 FROM team_profiles WHERE name=? COLLATE NOCASE LIMIT 1`).get(values.teamName);
  if (activeTeam) throw new Error('A team account already exists for this team name.');
  const now = new Date().toISOString();
  const id = randomUUID();
  database.prepare(`INSERT INTO team_account_requests (
    id, team_name, category, subcategory, description, team_email,
    representative_name, representative_identity, password_hash,
    website_url, instagram_url, logo_data, status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval', ?, ?)`).run(
    id, values.teamName, values.category, values.subcategory, values.description,
    values.teamEmail, values.representativeName, values.representativeIdentity,
    values.passwordHash, values.websiteUrl, values.instagramUrl, values.logoData,
    now, now,
  );
  return publicRequest(database.prepare('SELECT * FROM team_account_requests WHERE id=?').get(id));
}

export function listPendingTeamAccountRequests() {
  return database.prepare("SELECT id, team_name, category, subcategory, description, team_email, representative_name, representative_identity, website_url, instagram_url, logo_data, created_at FROM team_account_requests WHERE status='pending_approval' ORDER BY created_at")
    .all().map((row) => ({ id: row.id, teamName: row.team_name, category: row.category, subcategory: row.subcategory,
      description: row.description, teamEmail: row.team_email, representativeName: row.representative_name,
      representativeIdentity: row.representative_identity, websiteUrl: row.website_url, instagramUrl: row.instagram_url,
      hasLogo: Boolean(row.logo_data), createdAt: row.created_at }));
}

export function getPendingTeamAccountRequest(requestId) {
  const row = database.prepare("SELECT id, logo_data FROM team_account_requests WHERE id=? AND status='pending_approval'").get(requestId);
  return row ? { id: row.id, logoData: row.logo_data } : null;
}

export function reviewTeamAccountRequest(requestId, decision, reason = '') {
  if (!['approve', 'reject'].includes(decision)) throw new Error('Choose approve or reject.');
  const request = database.prepare("SELECT * FROM team_account_requests WHERE id=? AND status='pending_approval'").get(requestId);
  if (!request) throw new Error('No pending team request was found with that ID.');
  const now = new Date().toISOString();
  database.exec('BEGIN IMMEDIATE');
  try {
    const stillPending = database.prepare("SELECT * FROM team_account_requests WHERE id=? AND status='pending_approval'").get(requestId);
    if (!stillPending) throw new Error('This request has already been reviewed.');
    if (decision === 'approve') {
      const existingUser = database.prepare('SELECT id FROM users WHERE email=? COLLATE NOCASE').get(stillPending.team_email);
      if (existingUser) throw new Error('An account already uses this team email. Resolve that account before approval.');
      const existingProfile = database.prepare('SELECT id FROM team_profiles WHERE name=? COLLATE NOCASE').get(stillPending.team_name);
      if (existingProfile) throw new Error('A team profile already uses this team name. Resolve that profile before approval.');
      const userId = randomUUID();
      database.prepare(`INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'organizer', ?, ?)`).run(userId, stillPending.representative_name, stillPending.team_email, stillPending.password_hash, now, now);
      database.prepare(`INSERT INTO team_profiles (id, organizer_id, name, description, category, subcategory,
        logo_data, website_url, instagram_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        randomUUID(), userId, stillPending.team_name, stillPending.description, stillPending.category,
        stillPending.subcategory, stillPending.logo_data, stillPending.website_url, stillPending.instagram_url, now, now,
      );
    }
    database.prepare(`UPDATE team_account_requests SET status=?, rejection_reason=?, password_hash='', representative_identity='', logo_data=NULL, reviewed_at=?, updated_at=? WHERE id=?`)
      .run(decision === 'approve' ? 'approved' : 'rejected', decision === 'reject' ? reason : '', now, now, requestId);
    database.exec('COMMIT');
    return { id: requestId, status: decision === 'approve' ? 'approved' : 'rejected' };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
