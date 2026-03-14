export const SUPER_ADMIN_DOMAINS = ['berriesandmango.com', 'rendeboo.com'];

export function isSuperAdminEmail(email) {
  if (!email || !email.includes('@')) {
    return false;
  }

  const domain = email.split('@').pop()?.toLowerCase();
  return SUPER_ADMIN_DOMAINS.includes(domain);
}
