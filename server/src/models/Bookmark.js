import { randomUUID } from 'node:crypto';
import { database } from '../database.js';

export function listBookmarks(studentId) {
  return database.prepare(`SELECT b.id AS bookmark_id, b.student_id, b.created_at AS bookmark_created_at,
    e.*, u.name AS organizer_name FROM bookmarks b JOIN events e ON e.id=b.event_id
    JOIN users u ON u.id=e.organizer_id WHERE b.student_id=? AND e.publication_status='published'
    ORDER BY b.created_at DESC`).all(studentId).map((row) => ({
    _id: row.bookmark_id, student: row.student_id, createdAt: row.bookmark_created_at,
    event: { _id: row.id, id: row.id, title: row.title, description: row.description, category: row.category, club: row.club,
      date: row.date, startTime: row.start_time, venue: row.venue, registrationDeadline: row.registration_deadline,
      announcement: row.announcement || '', reminderText: row.reminder_text || '', registrationUrl: row.registration_url || '', socialUrl: row.social_url || '', posterUrl: row.poster_data ? `/api/events/${row.id}/poster` : '',
      publicationStatus: row.publication_status, createdAt: row.created_at, updatedAt: row.updated_at,
      organizer: { _id: row.organizer_id, id: row.organizer_id, name: row.organizer_name } },
  }));
}

export function hasBookmark(studentId, eventId) {
  return Boolean(database.prepare('SELECT 1 FROM bookmarks WHERE student_id=? AND event_id=?').get(studentId, eventId));
}

export function createBookmark(studentId, eventId) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  database.prepare('INSERT INTO bookmarks (id, student_id, event_id, created_at) VALUES (?, ?, ?, ?)').run(id, studentId, eventId, createdAt);
  return { _id: id, student: studentId, event: eventId, createdAt };
}

export function deleteBookmark(studentId, eventId) {
  return database.prepare('DELETE FROM bookmarks WHERE student_id=? AND event_id=?').run(studentId, eventId).changes > 0;
}
