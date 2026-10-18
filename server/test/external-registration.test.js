import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const databasePath = join(tmpdir(), `campusloop-external-registration-${randomUUID()}.sqlite`);
process.env.CAMPUSLOOP_DB_PATH = databasePath;

const { database } = await import('../src/database.js');
const { createUser } = await import('../src/models/User.js');
const { createEvent } = await import('../src/models/Event.js');
const { default: registrationRoutes } = await import('../src/routes/registrations.js');
const registrationRoute = registrationRoutes.stack.find((layer) => layer.route?.path === '/:eventId')?.route;
const registrationHandler = registrationRoute?.stack.find((layer) => layer.method === 'post')?.handle;

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}

const eventValues = (registrationMode, registrationUrl = '') => ({
  title: `${registrationMode} registration test event`,
  description: 'A long enough event description for the registration route test.',
  category: 'Technology', club: 'Test Club', date: new Date(Date.now() + 2 * 86400000),
  startTime: '18:30', venue: 'Main Hall', registrationDeadline: new Date(Date.now() + 60 * 60 * 1000),
  registrationMode, registrationUrl,
});

after(async () => {
  database.close();
  await rm(databasePath, { force: true });
});

test('internal registration is stored once while external forms are never counted internally', async () => {
  assert.equal(typeof registrationHandler, 'function');
  const organizer = createUser({ name: 'Test Organizer', email: 'organizer@example.test', passwordHash: 'test-hash', role: 'organizer' });
  const student = createUser({ name: 'Test Student', email: 'student@example.test', passwordHash: 'test-hash', role: 'student' });
  const internalEvent = createEvent(eventValues('internal'), organizer.id);
  const externalEvent = createEvent(eventValues('external', 'https://forms.example.test/event'), organizer.id);

  const register = async (eventId) => {
    const response = mockResponse();
    await registrationHandler({ params: { eventId }, user: { id: student.id } }, response, (error) => { throw error; });
    return response;
  };

  assert.equal((await register(internalEvent.id)).statusCode, 201);
  const duplicate = await register(internalEvent.id);
  assert.equal(duplicate.statusCode, 409);

  const external = await register(externalEvent.id);
  assert.equal(external.statusCode, 409);
  assert.match(external.body.error, /CampusLoop cannot confirm an external submission/);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM registrations WHERE event_id = ?').get(externalEvent.id).count, 0);
});
