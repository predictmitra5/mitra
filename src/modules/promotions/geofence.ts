const EARTH_RADIUS_METERS = 6_371_000;

export type Coordinates = { latitude: number; longitude: number };

export function isValidCoordinates(value: Coordinates): boolean {
  return Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
    && value.latitude >= -90 && value.latitude <= 90
    && value.longitude >= -180 && value.longitude <= 180;
}

/** Haversine distance; claimant coordinates are consumed in memory only. */
export function withinRadius(claimant: Coordinates, center: Coordinates, radiusMeters: number): boolean {
  if (!isValidCoordinates(claimant) || !isValidCoordinates(center)
    || !Number.isFinite(radiusMeters) || radiusMeters <= 0) return false;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latDelta = radians(center.latitude - claimant.latitude);
  const lonDelta = radians(center.longitude - claimant.longitude);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(claimant.latitude)) * Math.cos(radians(center.latitude)) * Math.sin(lonDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a)) <= radiusMeters;
}
