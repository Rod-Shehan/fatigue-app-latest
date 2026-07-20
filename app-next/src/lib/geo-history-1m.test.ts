import { describe, expect, it, beforeEach } from "vitest";
import {
  __pushHistory1mForTests,
  __resetHistory1mRingForTests,
  history1mTrailPositions,
  normalizeHistory1m,
  snapshotHistory1m,
} from "./geo-history-1m";

describe("normalizeHistory1m", () => {
  it("keeps finite crumbs in the last minute, oldest to newest", () => {
    const asOf = Date.parse("2026-07-20T12:00:00.000Z");
    const points = [
      { lat: -31.95, lng: 115.86, t: "2026-07-20T11:59:50.000Z" },
      { lat: -31.94, lng: 115.87, t: "2026-07-20T11:59:40.000Z" },
      { lat: -31.9, lng: 115.8, t: "2026-07-20T11:58:00.000Z" }, // too old
      { lat: Number.NaN, lng: 115.86, t: "2026-07-20T11:59:55.000Z" },
    ];
    expect(normalizeHistory1m(points, asOf)).toEqual([
      { lat: -31.94, lng: 115.87, t: "2026-07-20T11:59:40.000Z" },
      { lat: -31.95, lng: 115.86, t: "2026-07-20T11:59:50.000Z" },
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

describe("snapshotHistory1m ring", () => {
  beforeEach(() => {
    __resetHistory1mRingForTests();
  });

  it("returns spaced crumbs from the watch ring", () => {
    const t0 = Date.parse("2026-07-20T12:00:00.000Z");
    __pushHistory1mForTests(-31.96, 115.85, t0 - 40_000);
    __pushHistory1mForTests(-31.95, 115.86, t0 - 20_000);
    __pushHistory1mForTests(-31.95, 115.86, t0 - 15_000); // too close — skipped
    __pushHistory1mForTests(-31.94, 115.87, t0 - 5_000);
    expect(snapshotHistory1m(t0)).toEqual([
      { lat: -31.96, lng: 115.85, t: new Date(t0 - 40_000).toISOString() },
      { lat: -31.95, lng: 115.86, t: new Date(t0 - 20_000).toISOString() },
      { lat: -31.94, lng: 115.87, t: new Date(t0 - 5_000).toISOString() },
    ]);
  });
});
