import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { listPendingTeamAccountRequests, reviewTeamAccountRequest } from '../src/models/TeamAccountRequest.js';

const usage = 'Usage: npm run team-requests -- list | approve <request-id> | reject <request-id> [reason]';

export function runTeamRequestReview(action, requestId, reason = '') {
  if (action === 'list') return listPendingTeamAccountRequests();
  if (!['approve', 'reject'].includes(action) || typeof requestId !== 'string' || !requestId.trim()) throw new Error(usage);
  if (reason.length > 500) throw new Error('Rejection reason must be 500 characters or fewer.');
  return reviewTeamAccountRequest(requestId.trim(), action, reason.trim());
}

function main() {
  try {
    const result = runTeamRequestReview(process.argv[2], process.argv[3], process.argv.slice(4).join(' '));
    if (process.argv[2] === 'list') {
      if (!result.length) return console.log('No pending team account requests.');
      for (const item of result) console.log([
        `ID: ${item.id}`, `Team: ${item.teamName} (${item.category} / ${item.subcategory})`,
        `Team email: ${item.teamEmail}`, `Representative: ${item.representativeName}`,
        `Institutional details (unverified): ${item.representativeIdentity || 'not provided'}`,
        `Description: ${item.description}`, `Website: ${item.websiteUrl || 'not provided'}`,
        `Instagram: ${item.instagramUrl || 'not provided'}`, `Logo uploaded: ${item.hasLogo ? 'yes' : 'no'}`,
        `Submitted: ${item.createdAt}`, '',
      ].join('\n'));
    } else console.log(result.status === 'approved' ? 'Team request approved; organizer account and profile created.' : 'Team request rejected.');
  } catch (error) {
    console.error(error.message || usage);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
