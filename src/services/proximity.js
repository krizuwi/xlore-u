import { isCoordinate, privateHomeLocation } from './home-location.js';

const EARTH_RADIUS_KM = 6371;

// Approximate center points for Metro Manila cities. These are used only when
// the student has a city in their profile instead of a saved home pin.
const metroAreas = [
  { name: "Quezon City", aliases: ["quezon city", "q.c.", "qc"], latitude: 14.6760, longitude: 121.0437 },
  { name: "Las Piñas", aliases: ["las piñas", "las pinas"], latitude: 14.4445, longitude: 120.9939 },
  { name: "Mandaluyong", aliases: ["mandaluyong"], latitude: 14.5794, longitude: 121.0359 },
  { name: "Muntinlupa", aliases: ["muntinlupa", "alabang"], latitude: 14.4081, longitude: 121.0415 },
  { name: "Parañaque", aliases: ["parañaque", "paranaque"], latitude: 14.4793, longitude: 121.0198 },
  { name: "Taguig", aliases: ["taguig", "bgc", "bonifacio global city", "global city", "fort bonifacio"], latitude: 14.5176, longitude: 121.0509 },
  { name: "Caloocan", aliases: ["caloocan"], latitude: 14.6507, longitude: 120.9668 },
  { name: "Makati", aliases: ["makati"], latitude: 14.5547, longitude: 121.0244 },
  { name: "Malabon", aliases: ["malabon"], latitude: 14.6681, longitude: 120.9658 },
  { name: "Marikina", aliases: ["marikina"], latitude: 14.6507, longitude: 121.1029 },
  { name: "Navotas", aliases: ["navotas"], latitude: 14.6667, longitude: 120.9417 },
  { name: "Pasay", aliases: ["pasay"], latitude: 14.5378, longitude: 121.0014 },
  { name: "Pasig", aliases: ["pasig"], latitude: 14.5764, longitude: 121.0851 },
  { name: "Pateros", aliases: ["pateros"], latitude: 14.5445, longitude: 121.0686 },
  { name: "San Juan", aliases: ["san juan"], latitude: 14.6019, longitude: 121.0355 },
  { name: "Valenzuela", aliases: ["valenzuela"], latitude: 14.7011, longitude: 120.9830 },
  { name: "Manila", aliases: ["manila"], latitude: 14.5995, longitude: 120.9842 }
];

/** Remove accents and punctuation so city names match consistently. */
function normalizeAreaText(address) {
  return String(address ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/metro manila/g, "")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

function hasAlias(address, alias) {
  const normalizedAlias = normalizeAreaText(alias);
  return (` ${address} `).includes(` ${normalizedAlias} `);
}

/** Find the Metro Manila city mentioned in a profile address. */
export function resolveAddressArea(address) {
  const normalized = normalizeAreaText(address);
  if (!normalized) return null;
  return metroAreas.find((area) => area.aliases.some((alias) => hasAlias(normalized, alias))) ?? null;
}

/** Calculate the straight-line distance between two latitude/longitude points. */
export function haversineDistanceKm(from, to) {
  const degreesToRadians = value => Number(value) * Math.PI / 180;
  const startLatitude = degreesToRadians(from.latitude);
  const endLatitude = degreesToRadians(to.latitude);
  const latitudeDifference = endLatitude - startLatitude;
  const longitudeDifference = degreesToRadians(to.longitude) - degreesToRadians(from.longitude);

  // The haversine formula accounts for Earth's curvature. It is not a road route.
  const haversine = Math.min(1, Math.max(0,
    Math.sin(latitudeDifference / 2) ** 2
      + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDifference / 2) ** 2
  ));

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

/** Add approximate distances while keeping each school's other data unchanged. */
export function addSchoolDistances(schools, addressOrUser) {
  const user = typeof addressOrUser === 'object' && addressOrUser !== null ? addressOrUser : null;
  const home = privateHomeLocation(user);
  const area = resolveAddressArea(user ? user.address : addressOrUser);
  const origin = home ?? area;
  const enriched = schools.map((school) => {
    const hasCoordinates = isCoordinate(school.latitude, 90) && isCoordinate(school.longitude, 180);
    const distanceKm = origin && hasCoordinates
      ? Number(haversineDistanceKm(origin, school).toFixed(1))
      : null;
    return {
      ...school,
      distanceKm,
      distanceArea: home ? 'your saved home location' : area?.name ?? null,
      ...(home ? { distanceOrigin: 'home_pin' } : {})
    };
  });

  return {
    schools: enriched,
    locationBasis: home
      ? { area: 'your saved home location', kind: 'home_pin', approximate: true }
      : area
        ? { area: area.name, approximate: true }
        : null
  };
}

export function orderSchoolsByAddress(schools, address, limit = 6) {
  const { schools: enriched, locationBasis } = addSchoolDistances(schools, address);

  // Directory browsing favors nearby schools when a city is known, then uses
  // program match score, rating, and name to break ties.
  enriched.sort((left, right) => {
    if (locationBasis) {
      if (left.distanceKm == null && right.distanceKm != null) return 1;
      if (left.distanceKm != null && right.distanceKm == null) return -1;
      if (left.distanceKm != null && right.distanceKm != null && left.distanceKm !== right.distanceKm) {
        return left.distanceKm - right.distanceKm;
      }
    }
    return Number(right.matchScore ?? 0) - Number(left.matchScore ?? 0)
      || Number(right.googleRating ?? 0) - Number(left.googleRating ?? 0)
      || left.name.localeCompare(right.name);
  });

  return {
    schools: enriched.slice(0, limit),
    locationBasis
  };
}

/** Sort assessment results by fit, then proximity. Ratings do not affect fit. */
export function orderAssessmentSchools(schools, address, limit = Infinity) {
  const result = addSchoolDistances(schools, address);
  result.schools.sort((left, right) =>
    Number(right.matchScore ?? 0) - Number(left.matchScore ?? 0)
    || (left.distanceKm ?? Infinity) - (right.distanceKm ?? Infinity)
    || String(left.name).localeCompare(String(right.name))
    || String(left.id).localeCompare(String(right.id))
  );
  return { ...result, schools: result.schools.slice(0, limit) };
}
