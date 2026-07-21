/**
 * Map-facing helpers for diary GPS trails (history_1m).
 * Ported from app-next for Command Event Tracker — keep behaviour aligned.
 */

export type History1mPoint = {
  lat: number;
  lng: number;
  t: string;
};

const GEO_MAX_SEGMENT_POINTS = 120;

/** Sanitize stored crumbs for API/map. */
export function normalizeHistory1m(
  points: History1mPoint[] | null | undefined
): History1mPoint[] {
  if (!points?.length) return [];
  return points
    .filter(
      (p) =>
        p &&
        typeof p.lat === "number" &&
        typeof p.lng === "number" &&
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        typeof p.t === "string" &&
        Number.isFinite(Date.parse(p.t))
    )
    .map((p) => ({ lat: p.lat, lng: p.lng, t: p.t }))
    .sort((a, b) => a.t.localeCompare(b.t))
    .slice(-GEO_MAX_SEGMENT_POINTS);
}

/**
 * Leaflet positions: history crumbs oldest→newest, then current fix.
 * Dedupes if the last crumb already matches the current point.
 */
export function history1mTrailPositions(
  history: History1mPoint[] | null | undefined,
  current: { lat: number; lng: number }
): [number, number][] {
  const crumbs = normalizeHistory1m(history);
  const trail: [number, number][] = crumbs.map((p) => [p.lat, p.lng]);
  if (!Number.isFinite(current.lat) || !Number.isFinite(current.lng)) return trail;
  const last = trail[trail.length - 1];
  if (!last || last[0] !== current.lat || last[1] !== current.lng) {
    trail.push([current.lat, current.lng]);
  }
  return trail;
}
