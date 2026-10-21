import { assert } from './http-error.js';

// Unicode letters/accents are allowed; punctuation and control characters are not.
const personalName = /^(?:\p{L}\p{M}*| )*(?![\s\S])/u;
const schoolName = /^(?:\p{L}\p{M}*|[0-9 ])*(?![\s\S])/u;
const phone = /^[0-9]+(?![\s\S])/;

export function validatePersonalName(value, label) {
  assert(typeof value === 'string' && personalName.test(value), 400, `${label}: use letters and spaces only. Numbers and special characters are not allowed.`);
}
export function validateSchoolName(value) {
  assert(typeof value === 'string' && schoolName.test(value), 400, 'Institution name: use letters, numbers and spaces only. Special characters are not allowed.');
}
export function validatePhone(value) {
  assert(typeof value === 'string' && phone.test(value), 400, 'Contact telephone: use numbers only, without spaces, +, dashes or brackets.');
}
