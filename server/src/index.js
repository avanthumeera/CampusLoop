import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import { isDatabaseAvailable } from './database.js';
import { isUniqueConstraint } from './databaseErrors.js';
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import bookmarkRoutes from './routes/bookmarks.js';
import registrationRoutes from './routes/registrations.js';
import teamRoutes from './routes/team.js';
import teamBookmarkRoutes from './routes/teamBookmarks.js';
import adminRoutes from './routes/admin.js';

const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '3mb' }));
app.use(cookieParser());

app.get('/api/health', (_request, response) => {
  const connected = isDatabaseAvailable();
  response.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'error', database: connected ? 'connected' : 'disconnected' });
});

app.use('/api', (_request, response, next) => {
  if (!isDatabaseAvailable()) return response.status(503).json({ error: 'The local database is unavailable. Check that the server/data folder is writable, then restart the server.' });
  if (!process.env.JWT_SECRET) return response.status(503).json({ error: 'Authentication is not configured. Set JWT_SECRET in server/.env.' });
  next();
});
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/team-bookmarks', teamBookmarkRoutes);
app.use('/api/admin', adminRoutes);

app.use((error, _request, response, _next) => {
  if (error?.type === 'entity.too.large') return response.status(413).json({ error: 'The request payload is too large. Choose an image under 2 MB and try again.' });
  if (isUniqueConstraint(error)) return response.status(409).json({ error: 'This item already exists.' });
  if (error?.name === 'ValidationError' || error?.name === 'CastError') return response.status(400).json({ error: 'Some submitted details are invalid. Please check the form and try again.' });
  console.error('API error:', error.message);
  response.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
});

console.log('Connected to local SQLite database');
if (!process.env.JWT_SECRET) console.warn('JWT_SECRET is not configured. Set it in server/.env before using authentication.');

export { app };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(port, () => console.log(`CampusLoop API listening on http://localhost:${port}`));
}
