import { randomUUID } from 'node:crypto';
import { database } from '../database.js';

function toEvent(row) {
  if (!row) return null;
  const event = {
    _id: row.id, id: row.id, title: row.title, description: row.description,
    category: row.category, club: row.club, date: row.date, startTime: row.start_time,
    venue: row.venue, registrationDeadline: row.registration_deadline,
    announcement: row.announcement || '', reminderText: row.reminder_text || '', registrationMode: row.registration_mode || 'internal', registrationUrl: row.registration_url || '', socialUrl: row.social_url || '',
    posterUrl: row.poster_data ? `/api/events/${row.id}/poster` : '',
    publicationStatus: row.publication_status, createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.organizer_id) event.organizer = row.organizer_name ? { _id: row.organizer_id, id: row.organizer_id, name: row.organizer_name } : row.organizer_id;
  return event;
}

const eventSelect = `SELECT e.*, u.name AS organizer_name FROM events e JOIN users u ON u.id = e.organizer_id`;
const localDateString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function listPublishedEvents({ search = '', category = '', club = '' } = {}) {
  const clauses = ["e.publication_status = 'published'", 'e.date >= ?'];
  const values = [localDateString(new Date())];
  if (search) { clauses.push('instr(lower(e.title), lower(?)) > 0'); values.push(search); }
  if (category) { clauses.push('e.category = ?'); values.push(category); }
  if (club) { clauses.push('lower(e.club) = lower(?)'); values.push(club); }
  return database.prepare(`${eventSelect} WHERE ${clauses.join(' AND ')} ORDER BY e.date, e.start_time`).all(...values).map(toEvent);
}

export function listManagedEvents(organizerId) {
  return database.prepare(`${eventSelect} WHERE e.organizer_id = ? ORDER BY e.date, e.start_time`).all(organizerId).map(toEvent);
}

export function createEvent(values, organizerId) {
  const id = randomUUID();
  const now = new Date().toISOString();
  database.prepare(`INSERT INTO events (id, title, description, category, club, date, start_time, venue, registration_deadline, poster_data, announcement, reminder_text, registration_mode, registration_url, social_url, organizer_id, publication_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)`).run(
    id, values.title, values.description, values.category, values.club,
    localDateString(values.date), values.startTime, values.venue,
    new Date(values.registrationDeadline).toISOString(), values.posterData || null, values.announcement || null, values.reminderText || null,
    values.registrationMode || (values.registrationUrl ? 'external' : 'internal'), values.registrationUrl || null, values.socialUrl || null, organizerId, now, now,
  );
  return getEventById(id);
}

export function getEventPoster(id) {
  const row = database.prepare('SELECT poster_data FROM events WHERE id=?').get(id);
  return row?.poster_data || null;
}

export function getPublishedEvent(id) {
  return toEvent(database.prepare(`${eventSelect} WHERE e.id = ? AND e.publication_status = 'published'`).get(id));
}

export function getManagedEvent(id, organizerId) {
  return toEvent(database.prepare(`${eventSelect} WHERE e.id = ? AND e.organizer_id = ?`).get(id, organizerId));
}

export function getEventById(id) {
  return toEvent(database.prepare(`${eventSelect} WHERE e.id = ?`).get(id));
}

export function updateManagedEvent(id, organizerId, values) {
  const now = new Date().toISOString();
  const result = database.prepare(`UPDATE events SET title=?, description=?, category=?, club=?, date=?, start_time=?, venue=?, registration_deadline=?, registration_mode=?,
    poster_data=CASE WHEN ?=1 THEN NULL WHEN ?=1 THEN ? ELSE poster_data END,
    announcement=?, reminder_text=?, registration_url=?, social_url=?, updated_at=?
    WHERE id=? AND organizer_id=? AND publication_status != 'cancelled'`).run(
    values.title, values.description, values.category, values.club,
    localDateString(values.date), values.startTime, values.venue,
    new Date(values.registrationDeadline).toISOString(), values.registrationMode || (values.registrationUrl ? 'external' : 'internal'), values.removePoster ? 1 : 0,
    values.posterData !== undefined ? 1 : 0, values.posterData || null,
    values.announcement || null, values.reminderText || null, values.registrationUrl || null, values.socialUrl || null, now, id, organizerId,
  );
  return result.changes ? getEventById(id) : null;
}

export function cancelManagedEvent(id, organizerId) {
  const result = database.prepare("UPDATE events SET publication_status='cancelled', updated_at=? WHERE id=? AND organizer_id=?").run(new Date().toISOString(), id, organizerId);
  return result.changes ? getEventById(id) : null;
}
