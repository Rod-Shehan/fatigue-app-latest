import { describe, it, expect } from "vitest";
import { classifyMovementIntervals, computeEvidenceSummary } from "./evidence";

describe("evidence", () => {
  it("classifies moving interval with good GPS", () => {
    const intervals = classifyMovementIntervals([
      { time: "2026-01-01T00:00:00.000Z", type: "work", lat: -31.95, lng: 115.86, accuracy: 10 },
      { time: "2026-01-01T00:10:00.000Z", type: "work", lat: -31.90, lng: 115.86, accuracy: 10 },
    ]);
    expect(intervals.length).toBe(1);
    expect(intervals[0].movement).toBe("moving");
    expect(intervals[0].minutes).toBe(10);
  });

  it("returns low GPS coverage flag when most events lack GPS", () => {
    const s = computeEvidenceSummary([
      { events: [{ time: "2026-01-01T00:00:00.000Z", type: "work" }] },
      { events: [{ time: "2026-01-01T01:00:00.000Z", type: "stop", lat: -31.95, lng: 115.86, accuracy: 10 }] },
    ]);
    expect(s.totalEvents).toBe(2);
    expect(s.gpsEvents).toBe(1);
    // Threshold is "< 50%"; this scenario is exactly 50%, so should not flag.
    expect(s.flags.some((f) => f.code === "gps_low_coverage")).toBe(false);
  });
});

