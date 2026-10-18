export function isConfiguredAdmin(email) {
  const allowedEmails = (process.env.ADMIN_EMAILS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  return Boolean(email && allowedEmails.includes(email.trim().toLowerCase()));
}
