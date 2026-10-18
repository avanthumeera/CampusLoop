# CampusLoop

CampusLoop is a campus event and student-team discovery MVP. Students can find events and teams, save events, and register. Team representatives request approval before they can manage a team profile or publish events.

## Technology

- Frontend: React 19, Vite 6, and plain CSS
- API: Node.js 24 and Express 5, using JSON over REST
- Local database: SQLite through Node's built-in `node:sqlite` module
- Authentication: bcryptjs password hashes and JWTs stored in HTTP-only cookies
- Tests: Node's built-in test runner

The current app uses SQLite. It does not require MongoDB or a paid database service for local development. The local SQLite file is created automatically at `server/data/campusloop.sqlite` and is intentionally excluded from Git.

## Features

### Students

- Browse published events; search by title and filter by category or club.
- Open event details, bookmark events, and register for internal CampusLoop events.
- View saved and registered events and bookmark teams in the directory.
- Use separate Student Login and Team Login entry points.
- Follow external registration links when a team uses a form outside CampusLoop. CampusLoop cannot confirm or count submissions to an external form.

### Teams and organizers

- Submit a team-account request with category, profile details, links, and an optional original logo upload.
- Requests remain pending until an administrator approves them. Request submission does not grant team access.
- Approved representatives can edit their own team profile and manage only events owned by their account.
- Organizers can publish, edit, or cancel events and review registrations for their events.
- The server validates requests, checks role and ownership, and rejects duplicate bookmarks and registrations.

### Directory data and logos

`client/src/clubs.js` is the directory source. It is a source-backed partial directory, not a verified complete roster. Only logo images with a clear match to an existing directory entry are displayed; other user-supplied originals are retained unchanged but left unassigned. Logo provenance and official affiliation have not been independently verified, so the UI labels this status accordingly. No Instagram profiles are guessed.

## Requirements

- Node.js 24 or newer
- npm (included with Node.js)

Check versions with `node --version` and `npm --version`.

## Local setup (Windows PowerShell)

Open two terminals at the project root.

In the first terminal, configure the backend:

```powershell
cd server
npm install
Copy-Item .env.example .env
```

Open `server/.env` in VS Code. Set `JWT_SECRET` to a random secret and optionally configure `ADMIN_EMAILS` with an account you control. Do not commit or share this file. To generate a secret locally, run:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the generated value directly into your local `.env`; do not put it in frontend code or this README. `ADMIN_EMAILS` is a comma-separated allowlist of administrator account email addresses. Do not include a team applicant's address. Public signup cannot grant administrator or organizer roles.

In the second terminal, start the website and API:

```powershell
cd client
npm install
npm run dev -- --host 0.0.0.0 --port 5177
```

Open `http://localhost:5177/`. Keep this terminal running while you use the site. Vite mounts the existing Express app into the development server, so the browser sends `/api/...` requests to the same origin. A separate backend terminal is not required for this development flow. For API-only development, `cd server` and run `npm run dev` in another terminal; its default port is 3000.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | Yes for account/API actions | Signs session tokens. Keep it private and use a long random value. |
| `ADMIN_EMAILS` | No for ordinary student use; required for web admin review | Comma-separated allowlist for administrator accounts. |
| `PORT` | No | Standalone Express server port; defaults to `3000`. |
| `CAMPUSLOOP_DB_PATH` | No | Optional SQLite file path. Defaults to `server/data/campusloop.sqlite`. |

`server/.env.example` contains placeholders only. Never commit `.env`, database files, passwords, or tokens.

## Team approval workflow

1. A representative submits **Create Team Account**. The server validates the fields, hashes the password, and stores a pending request.
2. An administrator signs in with an account whose email is configured in `ADMIN_EMAILS`, then opens **Admin review**. Server routes independently enforce the allowlist.
3. Approval provisions the organizer account and private team profile. Rejection does not create a usable login.
4. The approved representative signs in through **Team Login**.

The local operator commands remain available from `server`:

```powershell
npm run team-requests -- list
npm run team-requests -- approve <request-id>
npm run team-requests -- reject <request-id> "Reason for rejection"
```

The app does not verify NITT identity, institutional email, or club affiliation. Submitted identity details are information for the human reviewer, not proof. The current model supports one representative login per team profile.

## Tests and build

From `server`:

```powershell
npm test
```

From `client`:

```powershell
npm run build
```

The tests cover student/team registration and login, role and administrator authorization, team approval/rejection, logo validation, event ownership, duplicate bookmarks and registrations, deadlines, and external-registration behavior.

## Manual smoke checks

1. Start the Vite development server and open `http://localhost:5177/`.
2. Open `http://localhost:5177/api/health`; the response should show `status: ok` and `database: connected`.
3. Create a student account, sign in, bookmark a team or event, and register once for an internal event.
4. Submit a team request. Confirm the pending-review message and verify Team Login is unavailable until approval.
5. Configure an administrator account through `ADMIN_EMAILS`, review the request, approve it, and sign in through Team Login.
6. Create an event as the representative and verify a student account cannot edit it or view its registration list.

## Request flow

React components in `client/src/App.jsx` render the pages and send requests to `/api/...`. During local development, `client/vite.config.js` attaches the Express app from `server/src/index.js` to Vite. Express routes validate inputs and check the session, role, and ownership before calling data-access functions in `server/src/models/`. `server/src/database.js` creates the SQLite tables and constraints. The API returns JSON and React updates the page with the result.

## Project map

```text
client/
  src/App.jsx              React pages, forms, navigation, and API calls
  src/styles.css           Responsive visual styles
  src/clubs.js             Team directory data and image mappings
  public/team-logos/       Supplied logo image copies
  vite.config.js           Vite development setup and local Express mounting
server/
  src/index.js             Express app, health endpoint, and error handling
  src/database.js          SQLite connection, schema, indexes, and migrations
  src/routes/              Authentication, events, bookmarks, registrations, teams, admin API
  src/models/              SQLite data-access functions
  src/middleware/auth.js   HTTP-only cookie authentication and role checks
  scripts/                 Local account and team-request operator commands
  test/                    Automated API and validation tests
shared/
  teamCategories.mjs       Team category and subcategory definitions
```

## Limitations and deployment status

- This is a development MVP. It does not include email verification, password reset, automatic NITT identity verification, or verified/exhaustive team and logo records.
- Events are not fabricated or pre-seeded. The event list remains empty until an authorized organizer publishes real event details.
- External form submissions cannot be tracked by CampusLoop.
- Local SQLite data lives on this computer and is not shared with other users.
- **The app has not been deployed publicly.** A public deployment needs an online hosting account and durable production storage. Do not deploy this SQLite database to an ephemeral filesystem: host restarts or redeploys can erase its data. Choose a persistent database/hosting arrangement before inviting real users.
- `localhost` is only reachable from your computer; it is not a public project URL for a form submission.
