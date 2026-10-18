import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEvent } from '../src/routes/events.js';

const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const validInput = () => ({
  title: 'Campus film night',
  description: 'Join the film club for a relaxed outdoor screening and conversation afterward.',
  category: 'Arts',
  club: 'Film Club',
  date: futureDate,
  startTime: '18:30',
  venue: 'Main lawn',
  registrationDeadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
});

test('accepts a complete future event with a future registration deadline', () => {
  const result = validateEvent(validInput());
  assert.equal(typeof result, 'object');
  assert.equal(result.title, 'Campus film night');
  assert.equal(result.registrationMode, 'internal');
  assert.ok(result.date instanceof Date);
  assert.ok(result.registrationDeadline instanceof Date);
});

test('rejects a short event title', () => {
  const result = validateEvent({ ...validInput(), title: 'Hi' });
  assert.match(result, /Title must be/);
});

test('rejects an unsupported event category', () => {
  const result = validateEvent({ ...validInput(), category: 'Unlisted' });
  assert.match(result, /valid event category/);
});

test('rejects a registration deadline in the past', () => {
  const result = validateEvent({ ...validInput(), registrationDeadline: new Date(Date.now() - 60_000).toISOString() });
  assert.match(result, /deadline must be in the future/);
});

test('defaults an omitted registration deadline to the event start and accepts organizer links', () => {
  const result = validateEvent({
    ...validInput(), registrationDeadline: '',
    announcement: 'Bring your ideas and join us!\nRegistration is on the official site.',
    registrationUrl: 'https://register.example.test/event',
    socialUrl: 'https://www.instagram.com/p/example/',
  });
  assert.equal(typeof result, 'object');
  assert.equal(result.registrationDeadline.getHours(), 18);
  assert.match(result.announcement, /Bring your ideas/);
  assert.equal(result.registrationUrl, 'https://register.example.test/event');
  assert.equal(result.registrationMode, 'external');
});

test('requires a valid external registration link and keeps internal registration exclusive', () => {
  assert.match(validateEvent({ ...validInput(), registrationMode: 'external' }), /external registration form link/);
  assert.match(validateEvent({ ...validInput(), registrationMode: 'internal', registrationUrl: 'https://forms.example.test/event' }), /Choose external registration/);
  assert.match(validateEvent({ ...validInput(), registrationMode: 'unknown' }), /Choose internal CampusLoop registration/);
});

test('rejects insecure organizer links and unsupported poster formats', () => {
  assert.match(validateEvent({ ...validInput(), registrationUrl: 'http://forms.example.test/event' }), /secure https link/);
  assert.match(validateEvent({ ...validInput(), posterData: 'data:image/svg+xml;base64,PHN2Zz4=' }), /JPEG, PNG, or WebP/);
});
