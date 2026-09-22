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

function normalizedAddress(address) {
  return String(address ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/metro manila/g, "")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

function hasAlias(address, alias) {
  const normalizedAlias = normalizedAddress(alias);
  return (` ${address} `).includes(` ${normalizedAlias} `);
}

export function resolveAddressArea(address) {
  const normalized = normalizedAddress(address);
  if (!normalized) return null;
  return metroAreas.find((area) => area.aliases.some((alias) => hasAlias(normalized, alias))) ?? null;
}

export function haversineDistanceKm(from, to) {
  const toRadians = (value) => Number(value) * Math.PI / 180;
  const latitudeDelta = toRadians(to.latitude) - toRadians(from.latitude);
  const longitudeDelta = toRadians(to.longitude) - toRadians(from.longitude);
  const startLatitude = toRadians(from.latitude);
  const endLatitude = toRadians(to.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function orderSchoolsByAddress(schools, address, limit = 6) {
  const area = resolveAddressArea(address);
  const enriched = schools.map((school) => {
    const hasCoordinates = Number.isFinite(Number(school.latitude)) && Number.isFinite(Number(school.longitude));
    const distanceKm = area && hasCoordinates
      ? Number(haversineDistanceKm(area, school).toFixed(1))
      : null;
    return { ...school, distanceKm, distanceArea: area?.name ?? null };
  });

  enriched.sort((left, right) => {
    if (area) {
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
    locationBasis: area ? { area: area.name, approximate: true } : null
  };
}
