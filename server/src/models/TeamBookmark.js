import { randomUUID } from 'node:crypto';
import { database } from '../database.js';

export function listTeamBookmarks(studentId) {
  return database.prepare('SELECT team_name AS teamName, created_at AS createdAt FROM team_bookmarks WHERE student_id=? ORDER BY created_at DESC').all(studentId);
}

export function addTeamBookmark(studentId, teamName) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  database.prepare('INSERT INTO team_bookmarks (id, student_id, team_name, created_at) VALUES (?, ?, ?, ?)').run(id, studentId, teamName, createdAt);
  return { id, teamName, createdAt };
}

export function removeTeamBookmark(studentId, teamName) {
  return database.prepare('DELETE FROM team_bookmarks WHERE student_id=? AND team_name=?').run(studentId, teamName).changes > 0;
}
