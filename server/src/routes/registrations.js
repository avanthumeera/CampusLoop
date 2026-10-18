import { Router } from 'express';
import { getPublishedEvent } from '../models/Event.js';
import { findRegistration, listStudentRegistrations, registerStudent } from '../models/Registration.js';
import { isUniqueConstraint } from '../databaseErrors.js';
import { requireAuth, requireStudent } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireStudent);

router.get('/', async (request, response, next) => {
  try {
    const registrations = listStudentRegistrations(request.user.id);
    response.json({ registrations });
  } catch (error) { next(error); }
});

router.post('/:eventId', async (request, response, next) => {
  try {
    if (!validId(request.params.eventId)) return response.status(404).json({ error: 'Event not found.' });
    const event = getPublishedEvent(request.params.eventId);
    if (!event) return response.status(404).json({ error: 'Event not found.' });
    if (event.registrationMode === 'external') return response.status(409).json({ error: 'This event uses an external registration form. CampusLoop cannot confirm an external submission.' });
    // SQLite returns this timestamp as text. Compare numeric timestamps so the
    // deadline check cannot accidentally become a lexicographic string compare.
    if (new Date(event.registrationDeadline).getTime() <= Date.now()) return response.status(400).json({ error: 'Registration for this event has closed.' });
    const existing = findRegistration(request.user.id, event.id);
    if (existing?.status === 'registered') return response.status(409).json({ error: 'You are already registered for this event.' });
    const registration = registerStudent(request.user.id, event.id);
    response.status(existing ? 200 : 201).json({ registration, message: 'You are registered for this event.' });
  } catch (error) {
    if (isUniqueConstraint(error)) return response.status(409).json({ error: 'You are already registered for this event.' });
    next(error);
  }
});
export default router;

const validId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

