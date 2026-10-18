import { Router } from 'express';
import { getPendingTeamAccountRequest, listPendingTeamAccountRequests, reviewTeamAccountRequest } from '../models/TeamAccountRequest.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/team-requests', (_request, response) => {
  response.json({ requests: listPendingTeamAccountRequests() });
});

router.get('/team-requests/:requestId/logo', (request, response) => {
  const item = getPendingTeamAccountRequest(request.params.requestId);
  const match = item?.logoData && /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(item.logoData);
  if (!match) return response.status(404).json({ error: 'No pending request logo was found.' });
  response.set('Cache-Control', 'private, no-store');
  response.type(match[1]).send(Buffer.from(match[2], 'base64'));
});

router.post('/team-requests/:requestId/approve', (request, response) => {
  try {
    const result = reviewTeamAccountRequest(request.params.requestId, 'approve');
    response.json({ request: result, message: 'Team request approved. The representative can now use Team Login.' });
  } catch (error) {
    const status = /No pending team request/.test(error.message) ? 404 : 409;
    response.status(status).json({ error: error.message || 'Could not approve this request.' });
  }
});

router.post('/team-requests/:requestId/reject', (request, response) => {
  const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim() : '';
  if (reason.length > 500) return response.status(400).json({ error: 'Rejection reason must be 500 characters or fewer.' });
  try {
    const result = reviewTeamAccountRequest(request.params.requestId, 'reject', reason);
    response.json({ request: result, message: 'Team account request rejected.' });
  } catch (error) {
    const status = /No pending team request/.test(error.message) ? 404 : 409;
    response.status(status).json({ error: error.message || 'Could not reject this request.' });
  }
});

export default router;
