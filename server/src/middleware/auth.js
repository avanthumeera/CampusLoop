import jwt from 'jsonwebtoken';
import { findUserById } from '../models/User.js';

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

export function signToken(user) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

export async function requireAuth(request, response, next) {
  try {
    const token = request.cookies?.campusloop_session;
    if (!token) return response.status(401).json({ error: 'Please log in to continue.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = findUserById(payload.sub);
    if (!user) return response.status(401).json({ error: 'Your session has expired. Please log in again.' });
    request.user = user;
    next();
  } catch {
    response.clearCookie('campusloop_session', cookieOptions);
    response.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
}

export function requireOrganizer(request, response, next) {
  if (request.user?.role !== 'organizer') return response.status(403).json({ error: 'Organizer access is required for this action.' });
  next();
}

export function requireStudent(request, response, next) {
  if (request.user?.role !== 'student') return response.status(403).json({ error: 'Student access is required for this action.' });
  next();
}
