import { institutionRegistrationLimits as limits } from './institution-registration.js';
import { validateSchoolName } from './identity-validation.js';

export function institutionName(value) {
  if (typeof value !== 'string') throw new Error('Institution name must be text.');
  validateSchoolName(value);
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > limits.schoolName) throw new Error(`Use 1–${limits.schoolName} characters for the institution name.`);
  return name;
}

export function institutionPassword(form) {
  if (!form.currentPassword) throw new Error('Enter your current password.');
  if (typeof form.newPassword !== 'string' || form.newPassword.length < 8 || form.newPassword.length > limits.password || new TextEncoder().encode(form.newPassword).length > limits.password) throw new Error('Use 8–72 characters and no more than 72 UTF-8 bytes for your new password.');
  if (form.newPassword !== form.confirmPassword) throw new Error('The new passwords do not match.');
  if (form.newPassword === form.currentPassword) throw new Error('Choose a new password different from your current password.');
  return { currentPassword: form.currentPassword, newPassword: form.newPassword, confirmPassword: form.confirmPassword };
}
