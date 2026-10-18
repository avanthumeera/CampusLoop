import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const databasePath = join(tmpdir(), `campusloop-records-${randomUUID()}.sqlite`);
process.env.CAMPUSLOOP_DB_PATH = databasePath;
const { database } = await import('../src/database.js');
const { createUser } = await import('../src/models/User.js');
const { createEvent, getEventPoster, listPublishedEvents, updateManagedEvent } = await import('../src/models/Event.js');
const { createBookmark, hasBookmark, listBookmarks } = await import('../src/models/Bookmark.js');
const { findRegistration, registerStudent, listStudentRegistrations } = await import('../src/models/Registration.js');

after(async () => {
  database.close();
  await rm(databasePath, { force: true });
});

test('SQLite repositories persist records and enforce unique student actions', () => {
  const organizer = createUser({ name: 'Organizer', email: 'organizer@example.test', passwordHash: 'hash', role: 'organizer' });
  const student = createUser({ name: 'Student', email: 'student@example.test', passwordHash: 'hash', role: 'student' });
  assert.throws(() => createUser({ name: 'Duplicate', email: 'STUDENT@example.test', passwordHash: 'hash', role: 'student' }), /UNIQUE constraint failed/);

  const eventValues = {
    title: 'Repository test campus event', description: 'A long enough description for the repository test event.',
    category: 'Technology', club: 'Test Club', date: new Date(Date.now() + 2 * 86400000),
    startTime: '18:30', venue: 'Main Hall', registrationDeadline: new Date(Date.now() + 3600000),
    posterData: 'data:image/png;base64,test-data', announcement: 'Bring your ideas.\nSee you there!',
    reminderText: 'Doors open at 6 pm.', registrationUrl: 'https://forms.example.test/event', socialUrl: 'https://instagram.com/p/example',
  };
  const event = createEvent(eventValues, organizer.id);
  assert.equal(event.registrationMode, 'external');
  assert.equal(event.announcement, eventValues.announcement);
  assert.equal(event.reminderText, eventValues.reminderText);
  assert.equal(event.registrationUrl, eventValues.registrationUrl);
  assert.equal(event.socialUrl, eventValues.socialUrl);
  assert.equal(getEventPoster(event.id), eventValues.posterData);
  assert.equal(event.posterUrl, `/api/events/${event.id}/poster`);
  const updated = updateManagedEvent(event.id, organizer.id, { ...eventValues, announcement: 'Updated announcement', posterData: undefined, removePoster: false });
  assert.equal(updated.announcement, 'Updated announcement');
  assert.equal(updated.posterUrl, event.posterUrl);
  const posterRemoved = updateManagedEvent(event.id, organizer.id, { ...eventValues, posterData: undefined, removePoster: true });
  assert.equal(posterRemoved.posterUrl, '');
  assert.equal(listPublishedEvents({ search: 'repository', category: 'Technology', club: 'test club' }).length, 1);

  createBookmark(student.id, event.id);
  assert.equal(hasBookmark(student.id, event.id), true);
  assert.equal(listBookmarks(student.id)[0].event.title, event.title);
  assert.throws(() => createBookmark(student.id, event.id), /UNIQUE constraint failed/);

  const first = registerStudent(student.id, event.id);
  const duplicate = registerStudent(student.id, event.id);
  assert.equal(first._id, duplicate._id);
  assert.equal(findRegistration(student.id, event.id).status, 'registered');
  assert.equal(listStudentRegistrations(student.id)[0].event.organizer.name, 'Organizer');
});
