const personalName = /^(?:\p{L}\p{M}*| )*(?![\s\S])/u;
const schoolName = /^(?:\p{L}\p{M}*|[0-9 ])*(?![\s\S])/u;
const phone = /^[0-9]+(?![\s\S])/;

export const personalNameInput = Object.freeze({ pattern: '(?:\\p{L}\\p{M}*| )+', title: 'Use letters and spaces only. Numbers and special characters are not allowed.' });
export const schoolNameInput = Object.freeze({ pattern: '(?:\\p{L}\\p{M}*|[0-9 ])+', title: 'Use letters, numbers and spaces only. Special characters are not allowed.' });
export const phoneInput = Object.freeze({ pattern: '[0-9]+', inputMode: 'numeric', title: 'Use numbers only, without spaces, +, dashes or brackets.' });

export function validatePersonalName(value, label) {
  if (typeof value !== 'string' || !personalName.test(value)) throw new Error(`${label}: use letters and spaces only. Numbers and special characters are not allowed.`);
}
export function validateSchoolName(value) {
  if (typeof value !== 'string' || !schoolName.test(value)) throw new Error('Institution name: use letters, numbers and spaces only. Special characters are not allowed.');
}
export function validatePhone(value) {
  if (typeof value !== 'string' || !phone.test(value)) throw new Error('Contact telephone: use numbers only, without spaces, +, dashes or brackets.');
}
export function identityInputProps(name, type) {
  if (['firstName', 'middleName', 'lastName'].includes(name)) return personalNameInput;
  if (['schoolName', 'proposedSchool.name'].includes(name)) return schoolNameInput;
  if (type === 'tel') return phoneInput;
  return {};
}
