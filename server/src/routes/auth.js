import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createUser, findUserByEmail } from '../models/User.js';
import { createTeamAccountRequest } from '../models/TeamAccountRequest.js';
import { isUniqueConstraint } from '../databaseErrors.js';
import { cookieOptions, requireAuth, signToken } from '../middleware/auth.js';
import { teamSubcategories } from '../../../shared/teamCategories.mjs';
import { isConfiguredAdmin } from '../adminAccess.js';

const router = Router();
const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email, role: user.role, isAdmin: isConfiguredAdmin(user.email) });

const teamCategories = Object.fromEntries(Object.entries(teamSubcategories).map(([name, values]) => [name.replace(' Teams', ''), values]));

function validSecureUrl(value, label, instagramOnly = false) {
  if (!value) return '';
  if (value.length > 2048) return `${label} URL must be 2048 characters or fewer.`;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname.includes('.')) return `${label} must be a valid https URL.`;
    if (instagramOnly && !['instagram.com', 'www.instagram.com'].includes(url.hostname)) return 'Instagram URL must point to instagram.com.';
  } catch { return `Enter a valid ${label} URL.`; }
  return '';
}

export function validateTeamRegistration(body = {}) {
  const teamName = typeof body.teamName === 'string' ? body.teamName.trim() : '';
  const category = typeof body.category === 'string' ? body.category : '';
  const subcategory = typeof body.subcategory === 'string' ? body.subcategory : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const teamEmail = typeof body.teamEmail === 'string' ? body.teamEmail.trim().toLowerCase() : '';
  const representativeName = typeof body.representativeName === 'string' ? body.representativeName.trim() : '';
  const representativeIdentity = typeof body.representativeIdentity === 'string' ? body.representativeIdentity.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (teamName.length < 2 || teamName.length > 100) return 'Team name must be between 2 and 100 characters.';
  if (!teamCategories[category]) return 'Choose Technical, Cultural, or Sports for the main category.';
  if (!teamCategories[category].includes(subcategory)) return 'Choose a valid subcategory for the selected team category.';
  if (description.length < 10 || description.length > 1000) return 'Description must be between 10 and 1000 characters.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teamEmail) || teamEmail.length > 254) return 'Enter a valid official team email.';
  if (representativeName.length < 2 || representativeName.length > 80) return 'Representative name must be between 2 and 80 characters.';
  if (representativeIdentity.length > 300) return 'Institutional identity details must be 300 characters or fewer.';
  if (typeof body.representativeEmail === 'string' && body.representativeEmail.trim() && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.representativeEmail.trim()) || body.representativeEmail.length > 254)) return 'Enter a valid representative institutional email.';
  if (password.length < 8 || password.length > 128) return 'Password must be between 8 and 128 characters.';
  if (typeof body.confirmPassword !== 'string' || body.confirmPassword !== password) return 'Passwords do not match.';
  const websiteUrl = typeof body.websiteUrl === 'string' ? body.websiteUrl.trim() : '';
  const instagramUrl = typeof body.instagramUrl === 'string' ? body.instagramUrl.trim() : '';
  const websiteError = validSecureUrl(websiteUrl, 'Website');
  if (websiteError) return websiteError;
  const instagramError = validSecureUrl(instagramUrl, 'Instagram', true);
  if (instagramError) return instagramError;
  let logoData = null;
  if (body.logoData) {
    if (typeof body.logoData !== 'string') return 'Choose a valid JPEG, PNG, or WebP logo.';
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
  return { teamName, category, subcategory, description, teamEmail, representativeName,
    representativeIdentity: [body.representativeEmail?.trim(), representativeIdentity].filter(Boolean).join(' · '),
    websiteUrl, instagramUrl, password, logoData };
}

export async function authenticateLogin(email, password, expectedRole) {
  const user = findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash)) || user.role !== expectedRole) return null;
  return user;
}

export function loginFailureMessage(expectedRole) {
  return expectedRole === 'organizer'
    ? 'Team Login is only for administrator-approved team accounts. If you signed up as a student, use Student Login until an authorized administrator approves team access. If you are already approved, check your email and password.'
    : 'Email or password is incorrect. If an administrator approved your account for team access, use Team Login.';
}

router.post('/register', async (request, response, next) => {
  try {
    const { name, email, password } = request.body ?? {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return response.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254) return response.status(400).json({ error: 'Enter a valid email address.' });
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) return response.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    const normalizedEmail = email.trim().toLowerCase();
    const existing = findUserByEmail(normalizedEmail);
    if (existing) return response.status(409).json({ error: 'An account with that email already exists.' });
    if (isConfiguredAdmin(normalizedEmail)) return response.status(403).json({ error: 'This email is reserved for the configured CampusLoop administrator. Log in to the existing account instead.' });
    // Public signup never assigns privileged roles. An administrator approves
    // organizer access separately with the local management command.
    const user = createUser({ name: name.trim(), email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), role: 'student' });
    response.cookie('campusloop_session', signToken(user), cookieOptions);
    response.status(201).json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post('/team-register', async (request, response, next) => {
  try {
    const values = validateTeamRegistration(request.body);
    if (typeof values === 'string') return response.status(400).json({ error: values });
    if (findUserByEmail(values.teamEmail)) return response.status(409).json({ error: 'An account already uses this team email.' });
    try {
      const pendingRequest = createTeamAccountRequest({ ...values, passwordHash: await bcrypt.hash(values.password, 12) });
      response.status(201).json({ message: 'Your team account request has been submitted for review.', request: pendingRequest });
    } catch (error) {
      if (isUniqueConstraint(error)) return response.status(409).json({ error: 'A request for this team name or team email already exists.' });
      if (/^A team account already exists/.test(error.message)) return response.status(409).json({ error: error.message });
      throw error;
    }
  } catch (error) { next(error); }
});

async function login(request, response, next, expectedRole) {
  try {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const password = typeof request.body?.password === 'string' ? request.body.password : '';
    const user = await authenticateLogin(email, password, expectedRole);
    if (!user) return response.status(401).json({ error: loginFailureMessage(expectedRole) });
    response.cookie('campusloop_session', signToken(user), cookieOptions);
    response.json({ user: publicUser(user) });
  } catch (error) { next(error); }
}

// Keep the two entry points distinct while sharing the same password/cookie
// handling. A public request cannot choose a role; role comes from the DB.
router.post('/login', (request, response, next) => login(request, response, next, 'student'));
router.post('/team-login', (request, response, next) => login(request, response, next, 'organizer'));

router.post('/logout', (_request, response) => { response.clearCookie('campusloop_session', cookieOptions); response.json({ message: 'You are logged out.' }); });
router.get('/me', requireAuth, (request, response) => response.json({ user: publicUser(request.user) }));
export default router;
