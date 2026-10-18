import { Router } from 'express';
import { getTeamLogo, getTeamProfile, updateTeamProfile } from '../models/TeamProfile.js';
import { requireAuth, requireOrganizer } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireOrganizer);

function validateProfile(body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (name.length < 2 || name.length > 100) return 'Team name must be between 2 and 100 characters.';
  if (description.length > 2000) return 'Description must be 2000 characters or fewer.';
  const links = {};
  for (const [field, label] of [['websiteUrl', 'website'], ['instagramUrl', 'Instagram']]) {
    links[field] = typeof body[field] === 'string' ? body[field].trim() : '';
    if (links[field]) {
      try {
        const parsed = new URL(links[field]);
        if (parsed.protocol !== 'https:' || !parsed.hostname.includes('.')) return `${label} link must be a valid secure https URL.`;
      } catch { return `Enter a valid ${label} URL.`; }
      if (field === 'instagramUrl' && !['instagram.com', 'www.instagram.com'].includes(new URL(links[field]).hostname)) return 'Use an Instagram profile URL.';
      if (links[field].length > 2048) return `${label} link is too long.`;
    }
  }
  let logoData;
  if (typeof body.logoData === 'string' && body.logoData) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.logoData);
    if (!match) return 'Team logo must be a JPEG, PNG, or WebP image.';
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length > 2 * 1024 * 1024) return 'Team logo must be 2 MB or smaller.';
    const valid = match[1] === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : match[1] === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!valid) return 'The selected file is not a valid image of that type.';
    logoData = body.logoData;
  }
  return { name, description, ...links, logoData, removeLogo: body.removeLogo === true };
}

router.get('/profile', (request, response, next) => {
  try {
    const profile = getTeamProfile(request.user.id);
    if (!profile) return response.status(404).json({ error: 'Team profile is not provisioned. Ask a CampusLoop administrator to approve your team account.' });
    response.json({ profile });
  } catch (error) { next(error); }
});

router.put('/profile', (request, response, next) => {
  try {
    const values = validateProfile(request.body);
    if (typeof values === 'string') return response.status(400).json({ error: values });
    const profile = updateTeamProfile(request.user.id, values);
    if (!profile) return response.status(404).json({ error: 'Team profile is not provisioned. Ask a CampusLoop administrator to approve your team account.' });
    response.json({ profile });
  } catch (error) { next(error); }
});

router.get('/logo', (request, response, next) => {
  try {
    const data = getTeamLogo(request.user.id);
    const match = data && /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
    if (!match) return response.status(404).end();
    response.set('Content-Type', match[1]).set('X-Content-Type-Options', 'nosniff').set('Cache-Control', 'private, no-cache');
    response.send(Buffer.from(match[2], 'base64'));
  } catch (error) { next(error); }
});

export { validateProfile };
export default router;
