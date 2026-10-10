export function formatComparisonDistance(distanceKm, locationBasis) {
  if (!locationBasis?.area) return "Address needed";
  if (distanceKm == null || (typeof distanceKm !== "number" && typeof distanceKm !== "string")
      || String(distanceKm).trim() === "" || !Number.isFinite(Number(distanceKm)) || Number(distanceKm) < 0) {
    return "Distance unavailable";
  }
  return `≈ ${Number(distanceKm).toFixed(1)} km`;
}
