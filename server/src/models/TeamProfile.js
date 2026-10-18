import { randomUUID } from 'node:crypto';
import { database } from '../database.js';

function toProfile(row) {
  if (!row) return null;
  return {
    id: row.id, name: row.name, description: row.description, category: row.category, subcategory: row.subcategory,
    logoUrl: row.logo_data ? `/api/team/logo` : '',
    websiteUrl: row.website_url, instagramUrl: row.instagram_url,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function ensureTeamProfile(organizerId, name) {
  const existing = database.prepare('SELECT * FROM team_profiles WHERE organizer_id=?').get(organizerId);
  if (existing) return toProfile(existing);
  const now = new Date().toISOString();
  const id = randomUUID();
  database.prepare(`INSERT INTO team_profiles (id, organizer_id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)`).run(id, organizerId, name.trim().slice(0, 100), now, now);
  return getTeamProfile(organizerId);
}

export function getTeamProfile(organizerId) {
  return toProfile(database.prepare('SELECT * FROM team_profiles WHERE organizer_id=?').get(organizerId));
}

export function getTeamLogo(organizerId) {
  return database.prepare('SELECT logo_data FROM team_profiles WHERE organizer_id=?').get(organizerId)?.logo_data || null;
}

export function updateTeamProfile(organizerId, values) {
  const now = new Date().toISOString();
  const result = database.prepare(`UPDATE team_profiles SET name=?, description=?,
    logo_data=CASE WHEN ?=1 THEN NULL WHEN ?=1 THEN ? ELSE logo_data END,
    website_url=?, instagram_url=?, updated_at=? WHERE organizer_id=?`).run(
    values.name, values.description, values.removeLogo ? 1 : 0,
    values.logoData !== undefined ? 1 : 0, values.logoData || null,
    values.websiteUrl, values.instagramUrl, now, organizerId,
  );
  return result.changes ? getTeamProfile(organizerId) : null;
}
