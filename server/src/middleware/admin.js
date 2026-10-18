import { isConfiguredAdmin } from '../adminAccess.js';

export function requireAdmin(request, response, next) {
  if (!isConfiguredAdmin(request.user?.email)) return response.status(403).json({ error: 'Administrator access is required for this action.' });
  next();
}
