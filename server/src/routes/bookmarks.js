import { Router } from 'express';
import { createBookmark, deleteBookmark, hasBookmark, listBookmarks } from '../models/Bookmark.js';
import { getPublishedEvent } from '../models/Event.js';
import { isUniqueConstraint } from '../databaseErrors.js';
import { requireAuth, requireStudent } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireStudent);

router.get('/', async (request, response, next) => {
  try {
    response.json({ bookmarks: listBookmarks(request.user.id) });
  } catch (error) { next(error); }
});

router.post('/:eventId', async (request, response, next) => {
  try {
    if (!validId(request.params.eventId)) return response.status(404).json({ error: 'Event not found.' });
    const event = getPublishedEvent(request.params.eventId);
    if (!event) return response.status(404).json({ error: 'Event not found.' });
    const existing = hasBookmark(request.user.id, event.id);
    if (existing) return response.status(409).json({ error: 'This event is already in your bookmarks.' });
    const bookmark = createBookmark(request.user.id, event.id);
    response.status(201).json({ bookmark });
  } catch (error) {
    if (isUniqueConstraint(error)) return response.status(409).json({ error: 'This event is already in your bookmarks.' });
    next(error);
  }
});

router.delete('/:eventId', async (request, response, next) => {
  try {
    if (!validId(request.params.eventId)) return response.status(404).json({ error: 'Bookmark not found.' });
    const removed = deleteBookmark(request.user.id, request.params.eventId);
    if (!removed) return response.status(404).json({ error: 'Bookmark not found.' });
    response.json({ message: 'Bookmark removed.' });
  } catch (error) { next(error); }
});
export default router;

const validId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

