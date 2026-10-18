import { Router } from 'express';
import { addTeamBookmark, listTeamBookmarks, removeTeamBookmark } from '../models/TeamBookmark.js';
import { isUniqueConstraint } from '../databaseErrors.js';
import { requireAuth, requireStudent } from '../middleware/auth.js';
import { clubs } from '../../../client/src/clubs.js';

const router = Router();
const officialTeamNames = new Map(clubs.map((team) => [team.name.toLocaleLowerCase(), team.name]));
router.use(requireAuth, requireStudent);
router.get('/', (request, response, next) => {
  try { response.json({ bookmarks: listTeamBookmarks(request.user.id) }); }
  catch (error) { next(error); }
});
router.post('/', (request, response, next) => {
  try {
    const teamName = typeof request.body?.teamName === 'string' ? request.body.teamName.trim() : '';
    const canonicalName = officialTeamNames.get(teamName.toLocaleLowerCase());
    if (teamName.length < 2 || teamName.length > 100 || !canonicalName) return response.status(400).json({ error: 'Choose a team from the CampusLoop directory.' });
    response.status(201).json({ bookmark: addTeamBookmark(request.user.id, canonicalName) });
  } catch (error) {
    if (isUniqueConstraint(error)) return response.status(409).json({ error: 'This team is already in your saved teams.' });
    next(error);
  }
});
router.delete('/:teamName', (request, response, next) => {
  try {
    const teamName = request.params.teamName.trim();
    const canonicalName = officialTeamNames.get(teamName.toLocaleLowerCase());
    if (teamName.length < 2 || teamName.length > 100 || !canonicalName) return response.status(404).json({ error: 'Saved team not found.' });
    if (!removeTeamBookmark(request.user.id, canonicalName)) return response.status(404).json({ error: 'Saved team not found.' });
    response.json({ message: 'Team removed from your saved list.' });
  } catch (error) { next(error); }
});
export default router;
