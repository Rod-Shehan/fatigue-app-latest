/**
 * Native browser GPS / Geolocation.
 * Uses navigator.geolocation (requires HTTPS or localhost in production).
 * Use for attaching location to logged events (work, break, end shift).
 * The browser will prompt for location permission on first use.
 */

/** Haversine distance between two points in km. */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type GeoPosition = {
  lat: number;
  lng: number;
  accuracy: number; // metres
};

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_AGE_MS = 10000;

/** Best-effort: faster fix, shorter wait. Use when logging events so UI isn’t blocked. */
export const BEST_EFFORT_OPTIONS = {
  timeout: 2500,
  maxAge: 8000,
  highAccuracy: false,
} as const;

/** Two-up Parked / End shift: wait longer for a pin that can prove stationary non-work. */
export const STATIONARY_GPS_OPTIONS = {
  timeout: 8000,
  maxAge: 4000,
  highAccuracy: true,
} as const;

export function geoFromTrailCrumb(
  crumb?: { lat: number; lng: number } | null
): GeoPosition | null {
  if (!crumb || !Number.isFinite(crumb.lat) || !Number.isFinite(crumb.lng)) return null;
  return { lat: crumb.lat, lng: crumb.lng, accuracy: 0 };
}

/** Live GPS, else last trail crumb. Null if neither is available. */
export async function resolveEventGpsFix(
  fallbackCrumb?: { lat: number; lng: number } | null,
  options: {
    timeout?: number;
    maxAge?: number;
    highAccuracy?: boolean;
  } = STATIONARY_GPS_OPTIONS
): Promise<GeoPosition | null> {
  const loc = await getCurrentPosition(options);
  return loc ?? geoFromTrailCrumb(fallbackCrumb);
}

export function isGeoAvailable(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

/**
 * Get current position via browser Geolocation API.
 * Returns null if unavailable, permission denied, timeout, or error.
 * For faster logging use getCurrentPosition({ ...BEST_EFFORT_OPTIONS }).
 */
export function getCurrentPosition(options?: {
  timeout?: number;
  maxAge?: number;
  highAccuracy?: boolean;
}): Promise<GeoPosition | null> {
  if (!isGeoAvailable()) return Promise.resolve(null);
  const { timeout = DEFAULT_TIMEOUT_MS, maxAge = DEFAULT_MAX_AGE_MS, highAccuracy = true } = options ?? {};
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? 0,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: highAccuracy, timeout, maximumAge: maxAge }
    );
  });
}
