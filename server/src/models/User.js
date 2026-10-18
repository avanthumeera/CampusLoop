import { randomUUID } from 'node:crypto';
import { database } from '../database.js';

const toUser = (row) => row && ({ id: row.id, _id: row.id, name: row.name, email: row.email, role: row.role, passwordHash: row.password_hash, createdAt: row.created_at, updatedAt: row.updated_at });

export function createUser({ name, email, passwordHash, role }) {
  const now = new Date().toISOString();
  const id = randomUUID();
  database.prepare('INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, name, email, passwordHash, role, now, now);
  return findUserById(id);
}

export function findUserByEmail(email) {
  return toUser(database.prepare('SELECT * FROM users WHERE email = ?').get(email));
}

export function findUserById(id) {
  return toUser(database.prepare('SELECT * FROM users WHERE id = ?').get(id));
}

export function updateUserRoleByEmail(email, role) {
  if (!['student', 'organizer'].includes(role)) throw new Error('Choose a valid account role.');
  const normalizedEmail = email.trim().toLowerCase();
  const result = database.prepare('UPDATE users SET role = ?, updated_at = ? WHERE email = ?').run(role, new Date().toISOString(), normalizedEmail);
  return result.changes ? findUserByEmail(normalizedEmail) : null;
}
