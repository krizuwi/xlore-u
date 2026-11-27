const allowedRegistrationDomains = new Set(['gmail.com', 'yahoo.com', 'outlook.com']);

export const registrationEmailHint = 'Use a Gmail, Yahoo, or Outlook email address.';

export function hasAllowedRegistrationDomain(email) {
  if (typeof email !== 'string') return false;
  const normalizedEmail = email.trim().toLowerCase();
  const atIndex = normalizedEmail.lastIndexOf('@');
  return atIndex > 0 && allowedRegistrationDomains.has(normalizedEmail.slice(atIndex + 1));
}

export function validateRegistrationEmail(email) {
  if (!hasAllowedRegistrationDomain(email)) throw new Error(registrationEmailHint);
}
