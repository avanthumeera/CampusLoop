import { randomUUID } from 'node:crypto';
import { database } from '../database.js';

export function listStudentRegistrations(studentId) {
  return database.prepare(`SELECT r.*, e.id AS e_id, e.title, e.description, e.category, e.club, e.date, e.start_time,
    e.venue, e.registration_deadline, e.poster_data, e.announcement, e.reminder_text, e.registration_url, e.social_url,
    e.publication_status, e.created_at AS event_created_at,
    e.updated_at AS event_updated_at, e.organizer_id, u.name AS organizer_name
    FROM registrations r JOIN events e ON e.id=r.event_id JOIN users u ON u.id=e.organizer_id
    WHERE r.student_id=? ORDER BY r.registered_at DESC`).all(studentId).map((row) => ({
    _id: row.id, student: studentId, registeredAt: row.registered_at, status: row.status,
    event: { _id: row.e_id, id: row.e_id, title: row.title, description: row.description, category: row.category, club: row.club,
      date: row.date, startTime: row.start_time, venue: row.venue, registrationDeadline: row.registration_deadline,
      announcement: row.announcement || '', reminderText: row.reminder_text || '', registrationUrl: row.registration_url || '', socialUrl: row.social_url || '', posterUrl: row.poster_data ? `/api/events/${row.e_id}/poster` : '',
      publicationStatus: row.publication_status, createdAt: row.event_created_at, updatedAt: row.event_updated_at,
      organizer: { _id: row.organizer_id, id: row.organizer_id, name: row.organizer_name } },
  }));
}

export function findRegistration(studentId, eventId) {
  const row = database.prepare('SELECT * FROM registrations WHERE student_id=? AND event_id=?').get(studentId, eventId);
  return row && { _id: row.id, student: row.student_id, event: row.event_id, registeredAt: row.registered_at, status: row.status };
}

export function registerStudent(studentId, eventId) {
  const id = randomUUID();
  const registeredAt = new Date().toISOString();
  database.prepare("INSERT INTO registrations (id, student_id, event_id, registered_at, status) VALUES (?, ?, ?, ?, 'registered') ON CONFLICT(student_id, event_id) DO UPDATE SET registered_at=excluded.registered_at, status='registered' WHERE registrations.status='cancelled'").run(id, studentId, eventId, registeredAt);
  return findRegistration(studentId, eventId);
}

export function listEventRegistrations(eventId) {
  return database.prepare(`SELECT r.id, r.registered_at, r.status, u.id AS student_id, u.name, u.email
    FROM registrations r JOIN users u ON u.id=r.student_id
    WHERE r.event_id=? AND r.status='registered' ORDER BY r.registered_at DESC`).all(eventId).map((row) => ({
    _id: row.id, registeredAt: row.registered_at, status: row.status,
    student: { _id: row.student_id, id: row.student_id, name: row.name, email: row.email },
  }));
}
