import { validHomePoint } from './home-location.js';

export function optionalSchoolCoordinates(school) {
  const blank = value => value == null || typeof value === 'string' && value.trim() === '';
  const latitudeBlank = blank(school.latitude), longitudeBlank = blank(school.longitude);
  if (latitudeBlank !== longitudeBlank) throw new Error('Enter both latitude and longitude, or leave both blank.');
  if (latitudeBlank) return { latitude: null, longitude: null };
  const point = validHomePoint(school);
  if (!point) throw new Error('Use latitude from -90 to 90 and longitude from -180 to 180.');
  return point;
}

export function schoolMapQuery(school) {
  const point = validHomePoint(school);
  return point ? `${point.latitude},${point.longitude}` : [school.name, school.address, school.city].filter(Boolean).join(', ');
}

export const hasSchoolCoordinates = school => Boolean(validHomePoint(school));
