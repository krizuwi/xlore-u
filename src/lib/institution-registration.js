import { validatePersonalName, validatePhone, validateSchoolName } from './identity-validation.js';
import { optionalSchoolCoordinates } from './school-location.js';

export function optionalVerificationLink(value = '') {
  if (typeof value !== 'string' || value.length > 2000) throw new Error('Verification link must be text up to 2,000 characters.');
  const link = value.trim();
  if (!link) return '';
  let url;
  try { url = new URL(link); } catch { throw new Error('Enter a valid HTTPS verification link, or leave it blank.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use an HTTPS verification link without sign-in credentials.');
  return link;
}

export const institutionRegistrationLimits = Object.freeze({
  name: 20, email: 190, representativeTitle: 100, contactPhone: 30,
  verificationNote: 1000, schoolName: 190, city: 100, address: 255,
  url: 2000, description: 2000, password: 72, search: 100, code: 6
});

export function validateInstitutionRegistration(form, proposedSchool = null) {
  const limits = institutionRegistrationLimits;
  const check = (value, label, max, required = true) => {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`${label} must be ${required ? '1' : '0'}–${max} characters.`);
  };
  for (const [key, label] of [['firstName', 'First name'], ['middleName', 'Middle name'], ['lastName', 'Last name']]) {
    check(form[key] ?? '', label, limits.name, key !== 'middleName');
    validatePersonalName(form[key] ?? '', label);
  }
  check(form.email, 'Institution contact email', limits.email);
  check(form.representativeTitle, 'Position / designation', limits.representativeTitle);
  check(form.contactPhone, 'Contact telephone', limits.contactPhone);
  validatePhone(form.contactPhone);
  check(form.verificationNote, 'Verification instructions', limits.verificationNote);
  check(form.verificationUrl ?? '', 'Verification link', limits.url, false);
  optionalVerificationLink(form.verificationUrl ?? '');
  if (!form.password || form.password.length < 8 || form.password.length > limits.password || new TextEncoder().encode(form.password).length > limits.password) throw new Error('Use 8–72 characters and no more than 72 UTF-8 bytes for your password.');
  if (form.password !== form.confirmPassword) throw new Error('The passwords do not match. Re-enter your password.');
  if (proposedSchool) {
    optionalSchoolCoordinates(proposedSchool);
    validateSchoolName(proposedSchool.name);
    for (const [key, label, max, required] of [['name', 'School name', limits.schoolName, true], ['city', 'City', limits.city, true], ['address', 'Campus address', limits.address, true], ['website', 'Official website', limits.url, true], ['description', 'School description', limits.description, false]]) check(proposedSchool[key] ?? '', label, max, required);
  } else if (!form.schoolId) throw new Error('Select one existing school or request a new school.');
}
