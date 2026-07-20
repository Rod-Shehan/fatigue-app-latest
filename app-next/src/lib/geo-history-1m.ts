/**
 * GPS breadcrumb helpers for diary events.
 * history_1m = up to ~6 points (~10s apart) from the minute before a log fix.
 */

export type History1mPoint = {
  lat: number;
  lng: number;
  /** ISO timestamp when the crumb was sampled */
  t: string;
};

const HISTORY_1M_WINDOW_MS = 60_000;
const HISTORY_1M_MIN_GAP_MS = 9_000; // ~10s spacing (allow slight jitter)
const HISTORY_1M_MAX_POINTS = 10;

/** Keep only finite crumbs inside the last minute, oldest → newest. */
export function normalizeHistory1m(
  points: History1mPoint[] | null | undefined,
  asOfMs: number = Date.now()
): History1mPoint[] {
  if (!points?.length) return [];
  const floor = asOfMs - HISTORY_1M_WINDOW_MS;
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
    .filter((p) => Date.parse(p.t) >= floor && Date.parse(p.t) <= asOfMs + 1_000)
    .sort((a, b) => a.t.localeCompare(b.t))
    .slice(-HISTORY_1M_MAX_POINTS);
}

/**
 * Leaflet positions: history crumbs oldest→newest, then current fix.
 * Dedupes if the last crumb already matches the current point.
 * When `asOfMs` is set, applies the 1-minute window; otherwise only sanitizes
 * (API already windowed crumbs relative to the event time).
 */
export function history1mTrailPositions(
  history: History1mPoint[] | null | undefined,
  current: { lat: number; lng: number },
  asOfMs?: number
): [number, number][] {
  const crumbs =
    asOfMs != null
      ? normalizeHistory1m(history, asOfMs)
      : (history ?? [])
          .filter(
            (p) =>
              p &&
              typeof p.lat === "number" &&
              typeof p.lng === "number" &&
              Number.isFinite(p.lat) &&
              Number.isFinite(p.lng)
          )
          .slice()
          .sort((a, b) => String(a.t ?? "").localeCompare(String(b.t ?? "")));

  const trail: [number, number][] = crumbs.map((p) => [p.lat, p.lng]);
  if (!Number.isFinite(current.lat) || !Number.isFinite(current.lng)) return trail;
  const last = trail[trail.length - 1];
  if (!last || last[0] !== current.lat || last[1] !== current.lng) {
    trail.push([current.lat, current.lng]);
  }
  return trail;
}

type RingState = {
  points: History1mPoint[];
  watchId: number | null;
};

const ring: RingState = { points: [], watchId: null };

function pushRingPoint(lat: number, lng: number, tMs: number = Date.now()): void {
  const last = ring.points[ring.points.length - 1];
  if (last && tMs - Date.parse(last.t) < HISTORY_1M_MIN_GAP_MS) return;
  ring.points.push({ lat, lng, t: new Date(tMs).toISOString() });
  const floor = tMs - HISTORY_1M_WINDOW_MS;
  ring.points = ring.points.filter((p) => Date.parse(p.t) >= floor).slice(-HISTORY_1M_MAX_POINTS);
}

/** Snapshot of the in-memory 1-minute breadcrumb ring (for attaching to a log event). */
export function snapshotHistory1m(asOfMs: number = Date.now()): History1mPoint[] {
  return normalizeHistory1m(ring.points, asOfMs);
}

/** Start sampling ~10s crumbs via watchPosition (no-op if unavailable / already watching). */
export function startHistory1mWatch(): void {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
  if (ring.watchId != null) return;
  ring.watchId = navigator.geolocation.watchPosition(
    (pos) => {
      pushRingPoint(pos.coords.latitude, pos.coords.longitude, Date.now());
    },
    () => {
      /* permission denied / timeout — leave ring as-is */
    },
    { enableHighAccuracy: false, maximumAge: 8_000, timeout: 10_000 }
  );
}

export function stopHistory1mWatch(): void {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
  if (ring.watchId == null) return;
  navigator.geolocation.clearWatch(ring.watchId);
  ring.watchId = null;
}

/** Test helper — reset the ring without touching the watch. */
export function __resetHistory1mRingForTests(): void {
  ring.points = [];
}

/** Test helper — push a crumb as if watchPosition fired. */
export function __pushHistory1mForTests(lat: number, lng: number, tMs: number): void {
  pushRingPoint(lat, lng, tMs);
}
