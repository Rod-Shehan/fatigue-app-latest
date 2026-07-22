import { describe, expect, it, beforeEach } from "vitest";
import {
  __pushHistory1mForTests,
  __resetHistory1mRingForTests,
  clearHistory1mSegment,
  getGeoMovementState,
  history1mTrailPositions,
  normalizeHistory1m,
  snapshotHistory1m,
  GEO_STATIONARY_UNLOCK_MS,
} from "./geo-history-1m";

describe("normalizeHistory1m", () => {
  it("keeps finite crumbs oldest to newest (full segment, not last minute only)", () => {
    const points = [
      { lat: -31.95, lng: 115.86, t: "2026-07-20T11:00:00.000Z" },
      { lat: -31.94, lng: 115.87, t: "2026-07-20T11:30:00.000Z" },
      { lat: Number.NaN, lng: 115.86, t: "2026-07-20T11:59:55.000Z" },
      { lat: -31.93, lng: 115.88, t: "2026-07-20T12:00:00.000Z" },
    ];
    expect(normalizeHistory1m(points)).toEqual([
      { lat: -31.95, lng: 115.86, t: "2026-07-20T11:00:00.000Z" },
      { lat: -31.94, lng: 115.87, t: "2026-07-20T11:30:00.000Z" },
      { lat: -31.93, lng: 115.88, t: "2026-07-20T12:00:00.000Z" },
    ]);
  });
});

describe("history1mTrailPositions", () => {
  it("appends current fix after crumbs", () => {
    const trail = history1mTrailPositions(
      [
        { lat: -31.96, lng: 115.85, t: "2026-07-20T11:59:40.000Z" },
        { lat: -31.95, lng: 115.86, t: "2026-07-20T11:59:50.000Z" },
      ],
      { lat: -31.94, lng: 115.87 }
    );
    expect(trail).toEqual([
      [-31.96, 115.85],
      [-31.95, 115.86],
      [-31.94, 115.87],
    ]);
  });

  it("does not duplicate when last crumb equals current", () => {
    const trail = history1mTrailPositions(
      [{ lat: -31.94, lng: 115.87, t: "2026-07-20T11:59:50.000Z" }],
      { lat: -31.94, lng: 115.87 }
    );
    expect(trail).toEqual([[-31.94, 115.87]]);
  });
});

describe("segment trail + stationary wait", () => {
  beforeEach(() => {
    __resetHistory1mRingForTests();
  });

  it("keeps the first fix, skips stationary jitter, accepts real moves", () => {
    const t0 = Date.parse("2026-07-20T12:00:00.000Z");
    // ~1.1 km south of Perth CBD reference — spaced far enough for 40 m gate
    __pushHistory1mForTests(-31.95, 115.86, t0);
    __pushHistory1mForTests(-31.9501, 115.8601, t0 + 10_000); // ~15 m — wait
    __pushHistory1mForTests(-31.951, 115.861, t0 + 20_000); // ~140 m — keep
    __pushHistory1mForTests(-31.952, 115.862, t0 + 25_000); // moved but <10 s — skip
    __pushHistory1mForTests(-31.953, 115.863, t0 + 35_000); // keep

    const snap = snapshotHistory1m(t0 + 40_000);
    expect(snap).toHaveLength(3);
    expect(snap[0].lat).toBe(-31.95);
    expect(snap[1].lat).toBe(-31.951);
    expect(snap[2].lat).toBe(-31.953);
  });

  it("locks movement after a significant move and unlocks after dwell", () => {
    const t0 = Date.parse("2026-07-20T12:00:00.000Z");
    __pushHistory1mForTests(-31.95, 115.86, t0);
    expect(getGeoMovementState(t0).isMoving).toBe(false);

    __pushHistory1mForTests(-31.952, 115.862, t0 + 5_000);
    expect(getGeoMovementState(t0 + 5_000).isMoving).toBe(true);
    expect(getGeoMovementState(t0 + 5_000 + GEO_STATIONARY_UNLOCK_MS - 1).isMoving).toBe(true);
    expect(getGeoMovementState(t0 + 5_000 + GEO_STATIONARY_UNLOCK_MS + 1).isMoving).toBe(false);
  });

  it("does not lock from GPS cold-start jitter with poor accuracy", () => {
    const t0 = Date.parse("2026-07-20T12:00:00.000Z");
    // ~55 m apart — would have locked under the old 40 m gate, but accuracy circles overlap.
    __pushHistory1mForTests(-31.95, 115.86, t0, { accuracyM: 100 });
    __pushHistory1mForTests(-31.9504, 115.8604, t0 + 12_000, { accuracyM: 100 });
    expect(getGeoMovementState(t0 + 12_000).isMoving).toBe(false);
  });

  it("still locks when reported speed is high with usable accuracy", () => {
    const t0 = Date.parse("2026-07-20T12:00:00.000Z");
    __pushHistory1mForTests(-31.95, 115.86, t0, { accuracyM: 20 });
    __pushHistory1mForTests(-31.95, 115.86, t0 + 2_000, { speedMs: 8, accuracyM: 20 });
    expect(getGeoMovementState(t0 + 2_000).isMoving).toBe(true);
  });

  it("reports unlock progress from 0 after move toward 1 at dwell end", () => {
    const t0 = Date.parse("2026-07-20T12:00:00.000Z");
    __pushHistory1mForTests(-31.95, 115.86, t0);
    __pushHistory1mForTests(-31.952, 115.862, t0 + 5_000);
    expect(getGeoMovementState(t0 + 5_000).unlockProgress01).toBeCloseTo(0, 2);
    expect(
      getGeoMovementState(t0 + 5_000 + GEO_STATIONARY_UNLOCK_MS / 2).unlockProgress01
    ).toBeCloseTo(0.5, 1);
    expect(
      getGeoMovementState(t0 + 5_000 + GEO_STATIONARY_UNLOCK_MS).unlockProgress01
    ).toBe(1);
  });

  it("clearHistory1mSegment drops crumbs but keeps movement dwell", () => {
    const t0 = Date.parse("2026-07-20T12:00:00.000Z");
    __pushHistory1mForTests(-31.95, 115.86, t0);
    __pushHistory1mForTests(-31.952, 115.862, t0 + 5_000);
    clearHistory1mSegment();
    expect(snapshotHistory1m()).toEqual([]);
    expect(getGeoMovementState(t0 + 5_000).isMoving).toBe(true);
  });
});
