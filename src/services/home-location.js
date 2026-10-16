import { assert } from '../utils/http-error.js';

export function isCoordinate(value, maximum) {
  return (typeof value === 'number' || (typeof value === 'string' && value.trim() !== ''))
    && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= maximum;
}

const normalizeAddress = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// Only the authenticated account's /auth responses expose its own coordinates.
// Shared recommendation responses expose a distance and basis, never this point.
export function privateHomeLocation(user) {
  const point = user?.home_location;
  if (!point || typeof point !== 'object' || Array.isArray(point)
      || typeof point.address !== 'string' || !normalizeAddress(point.address)
      || normalizeAddress(point.address) !== normalizeAddress(user.address)
      || !isCoordinate(point.latitude, 90) || !isCoordinate(point.longitude, 180)) return null;
  return { latitude: Number(point.latitude), longitude: Number(point.longitude) };
}

export function updateHomeLocation(body, user, nextAddress) {
  if (!Object.hasOwn(body, 'homeLocation')) {
    return privateHomeLocation({ ...user, address: nextAddress }) ? user.home_location : null;
  }
  if (body.homeLocation === null) return null;
  const point = body.homeLocation;
  assert(point && typeof point === 'object' && !Array.isArray(point)
    && point.confirmed === true, 400, 'Confirm your home pin before saving it.');
  assert(isCoordinate(point.latitude, 90) && isCoordinate(point.longitude, 180), 400,
    'Choose a valid home location with latitude -90 to 90 and longitude -180 to 180.');
  return { latitude: Number(point.latitude), longitude: Number(point.longitude), address: nextAddress };
}
