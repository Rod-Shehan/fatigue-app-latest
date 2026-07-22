/**
 * GPS segment trail + movement lock for the driver log bar.
 *
 * - Samples via watchPosition while the live log bar is open.
 * - Keeps crumbs for the open segment (since last Work/Break/End shift dump).
 * - Stationary wait: only accept a crumb when the fix has moved ~40 m from the
 *   last kept point (and ~10 s has passed) — saves JSON size and map fuzz.
 * - Movement lock: recent significant movement locks Work/Break (geometry-only hero).
 *
 * Stored on diary events as `history_1m` (legacy field name; now a segment trail).
 */

import { haversineDistanceKm } from "@/lib/geo";

export type History1mPoint = {
  lat: number;
  lng: number;
  /** ISO timestamp when the crumb was sampled */
  t: string;
};

/** Metres of movement required to accept a new trail crumb (and baseline for "moving"). */
export const GEO_MOVE_THRESHOLD_M = 40;
/** Minimum spacing between accepted crumbs while moving. */
export const GEO_MIN_GAP_MS = 9_000;
/** Cap trail length per segment (safety valve for sheet JSON). */
export const GEO_MAX_SEGMENT_POINTS = 120;
/**
 * After the last significant move, stay in "moving" lock this long before
 * unlocking Work/Break (hysteresis so the button does not flicker at lights).
 */
export const GEO_STATIONARY_UNLOCK_MS = 25_000;
/**
 * Ignore distance-based movement lock when horizontal accuracy is worse than this
 * (cold-start GPS jitter was blanking the hero after ~10–15s while parked).
 */
export const GEO_LOCK_MAX_ACCURACY_M = 80;

export type GeoMovementState = {
  isMoving: boolean;
  lastMovedAtMs: number | null;
  acceptedCount: number;
};

type RingState = {
  points: History1mPoint[];
  watchId: number | null;
  lastFix: { lat: number; lng: number; tMs: number; accuracyM: number | null } | null;
  lastMovedAtMs: number | null;
  listeners: Set<(state: GeoMovementState) => void>;
};

const ring: RingState = {
  points: [],
  watchId: null,
  lastFix: null,
  lastMovedAtMs: null,
  listeners: new Set(),
};

function metresBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  return haversineDistanceKm(a.lat, a.lng, b.lat, b.lng) * 1000;
}

function computeIsMoving(nowMs: number = Date.now()): boolean {
  if (ring.lastMovedAtMs == null) return false;
  return nowMs - ring.lastMovedAtMs < GEO_STATIONARY_UNLOCK_MS;
}

function emitMovement(): void {
  const state = getGeoMovementState();
  for (const listener of ring.listeners) listener(state);
}

export function getGeoMovementState(nowMs: number = Date.now()): GeoMovementState {
  return {
    isMoving: computeIsMoving(nowMs),
    lastMovedAtMs: ring.lastMovedAtMs,
    acceptedCount: ring.points.length,
  };
}

/** Subscribe to movement-lock updates from the GPS watch. Returns unsubscribe. */
export function subscribeGeoMovement(listener: (state: GeoMovementState) => void): () => void {
  ring.listeners.add(listener);
  listener(getGeoMovementState());
  return () => {
    ring.listeners.delete(listener);
  };
}

/** Sanitize stored crumbs for API/map — no 60s window (segment trails can be long). */
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

function tryAcceptTrailPoint(lat: number, lng: number, tMs: number): boolean {
  const last = ring.points[ring.points.length - 1];
  if (!last) {
    ring.points.push({ lat, lng, t: new Date(tMs).toISOString() });
    return true;
  }
  if (tMs - Date.parse(last.t) < GEO_MIN_GAP_MS) return false;
  if (metresBetween(last, { lat, lng }) < GEO_MOVE_THRESHOLD_M) return false;
  ring.points.push({ lat, lng, t: new Date(tMs).toISOString() });
  if (ring.points.length > GEO_MAX_SEGMENT_POINTS) {
    ring.points = ring.points.slice(-GEO_MAX_SEGMENT_POINTS);
  }
  return true;
}

/** ~7 km/h — aligns with evidence “moving” floor; used when the browser reports speed. */
const MOVING_SPEED_MS = 2;

function accuracyGoodEnough(accuracyM: number | null | undefined): boolean {
  if (accuracyM == null || !Number.isFinite(accuracyM)) return true;
  return accuracyM <= GEO_LOCK_MAX_ACCURACY_M;
}

function onWatchFix(
  lat: number,
  lng: number,
  tMs: number = Date.now(),
  speedMs: number | null = null,
  accuracyM: number | null = null
): void {
  const prev = ring.lastFix;
  const acc =
    typeof accuracyM === "number" && Number.isFinite(accuracyM) ? accuracyM : null;
  ring.lastFix = { lat, lng, tMs, accuracyM: acc };

  const thisOk = accuracyGoodEnough(acc);
  if (
    thisOk &&
    typeof speedMs === "number" &&
    Number.isFinite(speedMs) &&
    speedMs >= MOVING_SPEED_MS
  ) {
    ring.lastMovedAtMs = tMs;
  } else if (prev && thisOk && accuracyGoodEnough(prev.accuracyM)) {
    // Require movement beyond GPS error circles so parked cold-start jitter does not lock.
    const jitterFloor = (prev.accuracyM ?? 0) + (acc ?? 0);
    const needM = Math.max(GEO_MOVE_THRESHOLD_M, jitterFloor);
    if (metresBetween(prev, { lat, lng }) >= needM) {
      ring.lastMovedAtMs = tMs;
    }
  }

  // Stationary wait: only keep crumbs when we actually moved from the last kept point.
  tryAcceptTrailPoint(lat, lng, tMs);
  emitMovement();
}

/** Snapshot of accepted segment crumbs (for attaching to a log event). */
export function snapshotHistory1m(_asOfMs: number = Date.now()): History1mPoint[] {
  return normalizeHistory1m(ring.points);
}

/** Clear segment crumbs after a successful dump (next segment starts fresh). */
export function clearHistory1mSegment(): void {
  ring.points = [];
  // Keep lastFix / lastMovedAt so movement lock does not flash unlock mid-stop.
  emitMovement();
}

/** Start sampling via watchPosition (no-op if unavailable / already watching). */
export function startHistory1mWatch(): void {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
  if (ring.watchId != null) return;
  ring.watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const speed =
        typeof pos.coords.speed === "number" && Number.isFinite(pos.coords.speed)
          ? pos.coords.speed
          : null;
      const accuracy =
        typeof pos.coords.accuracy === "number" && Number.isFinite(pos.coords.accuracy)
          ? pos.coords.accuracy
          : null;
      onWatchFix(pos.coords.latitude, pos.coords.longitude, Date.now(), speed, accuracy);
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

/** Test helper — reset ring + movement state without touching the watch. */
export function __resetHistory1mRingForTests(): void {
  ring.points = [];
  ring.lastFix = null;
  ring.lastMovedAtMs = null;
}

/** Test helper — push a crumb as if watchPosition fired. */
export function __pushHistory1mForTests(
  lat: number,
  lng: number,
  tMs: number,
  opts?: { speedMs?: number | null; accuracyM?: number | null }
): void {
  onWatchFix(lat, lng, tMs, opts?.speedMs ?? null, opts?.accuracyM ?? 10);
}
