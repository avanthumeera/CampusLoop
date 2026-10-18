import { Router } from 'express';
import { createEvent, getEventPoster, getManagedEvent, getPublishedEvent, listManagedEvents, listPublishedEvents, updateManagedEvent, cancelManagedEvent } from '../models/Event.js';
import { listEventRegistrations } from '../models/Registration.js';
import { requireAuth, requireOrganizer } from '../middleware/auth.js';

const router = Router();
const categories = ['Arts', 'Career', 'Community', 'Food', 'Sports', 'Technology', 'Wellness', 'Other'];
const fields = ['title', 'description', 'category', 'club', 'date', 'startTime', 'venue', 'registrationDeadline', 'announcement', 'reminderText', 'registrationMode', 'registrationUrl', 'socialUrl'];
const validId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

function validateEvent(body) {
  const input = {};
  for (const field of fields) input[field] = body?.[field];
  for (const field of ['title', 'description', 'category', 'club', 'startTime', 'venue']) {
    if (typeof input[field] !== 'string' || !input[field].trim()) return `${field} is required.`;
    input[field] = input[field].trim();
  }
  if (input.title.length < 5 || input.title.length > 120) return 'Title must be between 5 and 120 characters.';
  if (input.description.length < 20 || input.description.length > 4000) return 'Description must be between 20 and 4000 characters.';
  if (!categories.includes(input.category)) return 'Choose a valid event category.';
  if (input.club.length < 2 || input.club.length > 100) return 'Club name must be between 2 and 100 characters.';
  if (input.venue.length < 2 || input.venue.length > 160) return 'Venue must be between 2 and 160 characters.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)) return 'Choose a valid start time.';
  if (typeof input.announcement !== 'string') input.announcement = '';
  input.announcement = input.announcement.trim();
  if (input.announcement.length > 4000) return 'Announcement must be 4000 characters or fewer.';
  if (typeof input.reminderText !== 'string') input.reminderText = '';
  input.reminderText = input.reminderText.trim();
  if (input.reminderText.length > 2000) return 'Reminder message must be 2000 characters or fewer.';
  for (const field of ['registrationUrl', 'socialUrl']) {
    input[field] = typeof input[field] === 'string' ? input[field].trim() : '';
    if (input[field]) {
      try { if (new URL(input[field]).protocol !== 'https:') return `${field} must use a secure https link.`; }
      catch { return `Enter a valid ${field === 'registrationUrl' ? 'registration' : 'social post'} link.`; }
      if (input[field].length > 2048) return `${field} is too long.`;
    }
  }
  input.registrationMode = body?.registrationMode ?? (input.registrationUrl ? 'external' : 'internal');
  if (!['internal', 'external'].includes(input.registrationMode)) return 'Choose internal CampusLoop registration or an external registration form.';
  if (input.registrationMode === 'external' && !input.registrationUrl) return 'Add the external registration form link.';
  if (input.registrationMode === 'internal' && input.registrationUrl) return 'Choose external registration to use a registration form link.';
  let posterData;
  if (typeof body?.posterData === 'string' && body.posterData) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.posterData);
    if (!match) return 'Poster must be a JPEG, PNG, or WebP image.';
    if (match[2].length > 2_800_000) return 'Poster image must be 2 MB or smaller.';
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length > 2 * 1024 * 1024) return 'Poster image must be 2 MB or smaller.';
    const hasSignature = match[1] === 'image/png'
      ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : match[1] === 'image/jpeg'
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!hasSignature) return 'The selected file is not a valid image of that type.';
    posterData = body.posterData;
  }
  const date = new Date(`${input.date}T00:00:00`);
  const deadline = input.registrationDeadline ? new Date(input.registrationDeadline) : new Date(`${input.date}T${input.startTime}:00`);
  if (Number.isNaN(date.valueOf()) || Number.isNaN(deadline.valueOf())) return 'Choose a valid event date and registration deadline.';
  const eventEnd = new Date(date);
  eventEnd.setDate(eventEnd.getDate() + 1);
  if (date < new Date(new Date().toDateString())) return 'Event date cannot be in the past.';
  if (deadline <= new Date() || deadline > eventEnd) return 'Registration deadline must be in the future and no later than the end of the event date.';
  return { ...input, date, registrationDeadline: deadline, posterData, removePoster: body?.removePoster === true };
}

router.get('/', async (request, response, next) => {
  try {
    const events = listPublishedEvents({
      search: typeof request.query.search === 'string' ? request.query.search.trim().slice(0, 80) : '',
      category: typeof request.query.category === 'string' && categories.includes(request.query.category) ? request.query.category : '',
      club: typeof request.query.club === 'string' ? request.query.club.trim().slice(0, 100) : '',
    });
    response.json({ events });
  } catch (error) { next(error); }
});

router.get('/managed', requireAuth, requireOrganizer, async (request, response, next) => {
  try {
    const events = listManagedEvents(request.user.id);
    response.json({ events });
  } catch (error) { next(error); }
});

router.get('/:id/poster', async (request, response, next) => {
  try {
    if (!validId(request.params.id)) return response.status(404).end();
    const posterData = getEventPoster(request.params.id);
    const match = posterData && /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(posterData);
    if (!match) return response.status(404).end();
    response.set('Content-Type', match[1]).set('X-Content-Type-Options', 'nosniff').set('Cache-Control', 'no-cache');
    response.send(Buffer.from(match[2], 'base64'));
  } catch (error) { next(error); }
});

router.post('/', requireAuth, requireOrganizer, async (request, response, next) => {
  try {
    const values = validateEvent(request.body);
    if (typeof values === 'string') return response.status(400).json({ error: values });
    const event = createEvent(values, request.user.id);
    response.status(201).json({ event });
  } catch (error) { next(error); }
});

router.get('/:id/registrations', requireAuth, requireOrganizer, async (request, response, next) => {
  try {
    if (!validId(request.params.id)) return response.status(404).json({ error: 'Event not found.' });
    const event = getManagedEvent(request.params.id, request.user.id);
    if (!event) return response.status(404).json({ error: 'Event not found.' });
    const registrations = listEventRegistrations(event.id);
    response.json({ registrations });
  } catch (error) { next(error); }
});

router.put('/:id', requireAuth, requireOrganizer, async (request, response, next) => {
  try {
    if (!validId(request.params.id)) return response.status(404).json({ error: 'Event not found.' });
    const values = validateEvent(request.body);
    if (typeof values === 'string') return response.status(400).json({ error: values });
    const event = updateManagedEvent(request.params.id, request.user.id, values);
    if (!event) return response.status(404).json({ error: 'Event not found or you do not manage it.' });
    response.json({ event });
  } catch (error) { next(error); }
});

router.delete('/:id', requireAuth, requireOrganizer, async (request, response, next) => {
  try {
    if (!validId(request.params.id)) return response.status(404).json({ error: 'Event not found.' });
    const event = cancelManagedEvent(request.params.id, request.user.id);
    if (!event) return response.status(404).json({ error: 'Event not found or you do not manage it.' });
    response.json({ event });
  } catch (error) { next(error); }
});

router.get('/:id', async (request, response, next) => {
  try {
    if (!validId(request.params.id)) return response.status(404).json({ error: 'Event not found.' });
    const event = getPublishedEvent(request.params.id);
    if (!event) return response.status(404).json({ error: 'Event not found.' });
    response.json({ event });
  } catch (error) { next(error); }
});

export { validateEvent };
export default router;
