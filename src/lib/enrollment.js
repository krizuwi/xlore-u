export const ENROLLMENT_DECLARATION_VERSION = 'enrollment-helpful-v1';
export const ENROLLMENT_DECLARATION = 'I confirm that I am enrolled at this school, used Xlore U to help find it, and found Xlore U helpful.';

export function enrollmentPayload(school, city, checked, version = ENROLLMENT_DECLARATION_VERSION) {
  if (!school?.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(school.id)) throw new Error('Select your school from the search results.');
  if (typeof city !== 'string' || city.length > 100 || !city.trim() || !/^(?:\p{L}\p{M}*|[ .'-])+(?![\s\S])/u.test(city.trim()) || !/\p{L}/u.test(city)) throw new Error('Enter your city or municipality only, up to 100 characters.');
  if (checked !== true || version !== ENROLLMENT_DECLARATION_VERSION) throw new Error('Check the enrollment and helpfulness declaration before submitting.');
  return { schoolId: school.id, city: city.normalize('NFC').trim().replace(/ +/g, ' '), usedXloreU: true, helpful: true, declarationVersion: version };
}

export function studentAccessPayload(student, reason) {
  if (!student?.id || typeof student.active !== 'boolean') throw new Error('Reload the student record.');
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 2000) throw new Error('Enter an administrator reason, up to 2,000 characters.');
  return { active: !student.active, expectedActive: student.active, reason: reason.trim() };
}
