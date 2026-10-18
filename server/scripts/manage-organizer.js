import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { updateUserRoleByEmail } from '../src/models/User.js';
import { ensureTeamProfile } from '../src/models/TeamProfile.js';

const usage = 'Usage: npm run organizer:approve -- <account-email> OR npm run organizer:revoke -- <account-email>';

export function changeOrganizerAccess(action, email) {
  if (!['approve', 'revoke'].includes(action)) throw new Error(usage);
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new Error('Enter the email address of an existing CampusLoop account.');
  }

  const user = updateUserRoleByEmail(email, action === 'approve' ? 'organizer' : 'student');
  if (!user) throw new Error('No account was found. The user must create a student account before approval.');
  if (action === 'approve') ensureTeamProfile(user.id, user.name);
  return user.role;
}

function main() {
  try {
    const role = changeOrganizerAccess(process.argv[2], process.argv[3]);
    console.log(role === 'organizer' ? 'Organizer access approved.' : 'Organizer access revoked; account is now a student.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
