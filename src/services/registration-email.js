export const registrationEmailMessage = 'Use a Gmail, Yahoo, or Outlook email address to register.';

const allowedRegistrationDomains = new Set(['gmail.com', 'yahoo.com', 'outlook.com']);

/** Check the mailbox domain after the caller has normalized and validated the email. */
export function hasAllowedRegistrationDomain(email) {
  if (typeof email !== 'string') return false;
  const atIndex = email.lastIndexOf('@');
  return atIndex > 0 && allowedRegistrationDomains.has(email.slice(atIndex + 1).toLowerCase());
}
