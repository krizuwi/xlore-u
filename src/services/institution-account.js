import { assert } from '../utils/http-error.js';
import { institutionRegistrationLimits as limits } from './institution-registration.js';
import { validateSchoolName } from '../utils/identity-validation.js';

export function validateInstitutionName(value) {
  assert(typeof value === 'string', 400, 'Institution name must be text.');
  validateSchoolName(value);
  const name = value.trim().replace(/\s+/g, ' ');
  assert(name.length >= 1 && name.length <= limits.schoolName, 400, `Institution name must be 1–${limits.schoolName} characters.`);
  return name;
}

export function validateInstitutionPassword(body) {
  const { currentPassword, newPassword, confirmPassword } = body ?? {};
  assert(typeof currentPassword === 'string' && currentPassword.length > 0 && currentPassword.length <= 1000, 400, 'Enter your current password.');
  assert(typeof newPassword === 'string' && newPassword.length >= 8 && newPassword.length <= limits.password && Buffer.byteLength(newPassword, 'utf8') <= limits.password, 400, 'Use 8–72 characters and no more than 72 UTF-8 bytes for your new password.');
  assert(typeof confirmPassword === 'string' && newPassword === confirmPassword, 400, 'The new passwords do not match.');
  assert(newPassword !== currentPassword, 400, 'Choose a new password different from your current password.');
  return { currentPassword, newPassword };
}
