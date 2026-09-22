import { describe, expect, it } from "vitest";
import { SLEEPER_BERTH_EVENT_TYPE, STATIONARY_REST_EVENT_TYPE } from "./activity-kind";
import {
  collectTwoUpDeclaredStationaryRanges,
  evaluateTwoUp48hStationaryOption,
  evaluateTwoUp7dStationaryOption,
  eventHasGps,
  paintProvenStationaryNonWork,
  scoreTwoUp184E3b,
} from "./two-up-stationary";

const BASE = Date.UTC(2026, 7, 1, 0, 0, 0);
const H = 3600_000;
const GPS = { lat: -31.95, lng: 115.86 };

describe("two-up stationary 184E(3)(b)", () => {
  it("requires GPS on Parked / End shift", () => {
    expect(eventHasGps({ time: "", type: "stop", ...GPS })).toBe(true);
    expect(eventHasGps({ time: "", type: STATIONARY_REST_EVENT_TYPE })).toBe(false);
  });

  it("7h GPS Parked meets 48h option; 7h sleeper does not", () => {
    const parked = [
      { time: new Date(BASE).toISOString(), type: "work" },
      {
        time: new Date(BASE + 10 * H).toISOString(),
        type: STATIONARY_REST_EVENT_TYPE,
        ...GPS,
      },
    ];
    const asOf = BASE + 17 * H;
    expect(evaluateTwoUp48hStationaryOption(parked, asOf, BASE).hasQualBlock).toBe(true);

    const sleeper = [
      { time: new Date(BASE).toISOString(), type: "work" },
      {
        time: new Date(BASE + 10 * H).toISOString(),
        type: SLEEPER_BERTH_EVENT_TYPE,
        ...GPS,
      },
    ];
    expect(evaluateTwoUp48hStationaryOption(sleeper, asOf, BASE).hasQualBlock).toBe(false);
  });

  it("Parked without GPS does not count", () => {
    const events = [
      { time: new Date(BASE).toISOString(), type: "work" },
      { time: new Date(BASE + 10 * H).toISOString(), type: STATIONARY_REST_EVENT_TYPE },
    ];
    expect(evaluateTwoUp48hStationaryOption(events, BASE + 17 * H, BASE).hasQualBlock).toBe(false);
  });

  it("6h sleeper crumbs do not poison 7-day when GPS End shift supplies 48h including 24h", () => {
    const events = [
      { time: new Date(BASE).toISOString(), type: SLEEPER_BERTH_EVENT_TYPE, ...GPS },
      { time: new Date(BASE + 6 * H).toISOString(), type: "work" },
      { time: new Date(BASE + 12 * H).toISOString(), type: "stop", ...GPS },
    ];
    const asOf = BASE + 12 * H + 48 * H;
    const t7 = evaluateTwoUp7dStationaryOption(events, asOf, BASE);
    expect(t7.hasSubMinPiece).toBe(false);
    expect(t7.has24hBlock).toBe(true);
    expect(t7.structureOk).toBe(true);
  });

  it("paints only GPS End shift / Parked minutes", () => {
    const events = [
      { time: new Date(BASE).toISOString(), type: SLEEPER_BERTH_EVENT_TYPE, ...GPS },
      { time: new Date(BASE + 2 * H).toISOString(), type: STATIONARY_REST_EVENT_TYPE, ...GPS },
    ];
    const flags = paintProvenStationaryNonWork(events, BASE, BASE + 4 * H);
    const parked = flags.filter(Boolean).length;
    expect(parked).toBe(2 * 60);
  });

  it("D: no duty does not fail 184E(3)(b)", () => {
    const scored = scoreTwoUp184E3b([], BASE + 10 * H, { hasDuty: false, firstDutyMs: undefined });
    expect(scored.ok).toBe(true);
    expect(scored.skipReason).toBe("not_enlivened");
  });

  it("E: duty younger than 48h does not fail without GPS rest", () => {
    const events = [{ time: new Date(BASE + 40 * H).toISOString(), type: "work" }];
    const scored = scoreTwoUp184E3b(events, BASE + 50 * H, {
      recordStartMs: BASE,
      hasDuty: true,
      firstDutyMs: BASE + 40 * H,
    });
    expect(scored.ok).toBe(true);
    expect(scored.skipReason).toBe("window_immature");
  });

  it("E: after 48h of duty, missing GPS rest fails", () => {
    const events = [{ time: new Date(BASE).toISOString(), type: "work" }];
    const scored = scoreTwoUp184E3b(events, BASE + 49 * H, {
      recordStartMs: BASE,
      hasDuty: true,
      firstDutyMs: BASE,
    });
    expect(scored.ok).toBe(false);
    expect(scored.skipReason).toBeNull();
  });

  it("F: declared 7h range in the last 48h meets the 48h option", () => {
    const start = new Date(BASE + 50 * H).toISOString();
    const end = new Date(BASE + 57 * H).toISOString();
    const ranges = collectTwoUpDeclaredStationaryRanges({
      last7hRestStart: start,
      last7hRestEnd: end,
    });
    expect(ranges).toHaveLength(1);
    const events = [{ time: new Date(BASE).toISOString(), type: "work" }];
    const scored = scoreTwoUp184E3b(events, BASE + 60 * H, {
      recordStartMs: BASE,
      hasDuty: true,
      firstDutyMs: BASE,
      declaredRanges: ranges,
    });
    expect(scored.t48.hasQualBlock).toBe(true);
    expect(scored.ok).toBe(true);
    expect(scored.skipReason).toBeNull();
  });
});
