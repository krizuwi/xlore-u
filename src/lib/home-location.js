export function validHomePoint(point) {
  if (!point || typeof point !== 'object') return null;
  const coordinate = (value, maximum) => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '')
    && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= maximum;
  return coordinate(point.latitude, 90) && coordinate(point.longitude, 180)
    ? { latitude: Number(point.latitude), longitude: Number(point.longitude) } : null;
}

export function homeLocationPayload(point) {
  if (point === null) return null;
  const coordinates = validHomePoint(point);
  if (!coordinates) throw new Error('Choose a valid home pin or remove it before saving.');
  if (point.confirmed !== true) throw new Error('Confirm that the selected pin is your home location before saving.');
  return { ...coordinates, confirmed: true };
}

export function distanceOriginLabel(school) {
  return school.distanceOrigin === 'home_pin' ? 'your saved home pin' : `${school.distanceArea} center (city estimate)`;
}

export function distanceLocationNote(basis) {
  return basis?.kind === 'home_pin'
    ? 'Distances are approximate straight-line distances from your saved home pin, not driving or commute distances.'
    : `Distances are approximate straight-line distances from the center of ${basis?.area}, inferred from your saved address—not driving or commute distances. Set a home pin in Profile for a more specific starting point.`;
}
