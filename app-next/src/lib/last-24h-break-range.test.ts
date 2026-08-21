import { describe, expect, it } from "vitest";
import {
  addHoursToPerthDatetimeLocal,
  formatLast24hBreakRangeDisplay,
  isoToPerthDatetimeLocal,
  perthDatetimeLocalToIso,
  validateLast24hBreakRange,
} from "./last-24h-break-range";

describe("last-24h-break-range", () => {
  it("adds 24 hours on the Perth wall clock", () => {
    expect(addHoursToPerthDatetimeLocal("2026-10-10T06:00", 24)).toBe("2026-10-11T06:00");
    expect(addHoursToPerthDatetimeLocal("2026-10-31T22:00", 24)).toBe("2026-11-01T22:00");
    expect(addHoursToPerthDatetimeLocal("not-a-time", 24)).toBe("");
  });

  it("round-trips Perth datetime-local via ISO", () => {
    const iso = perthDatetimeLocalToIso("2026-07-19T14:30");
    expect(iso).toBeTruthy();
    expect(isoToPerthDatetimeLocal(iso!)).toBe("2026-07-19T14:30");
  });

  it("requires ≥24h span", () => {
    const start = perthDatetimeLocalToIso("2026-07-19T08:00")!;
    const shortEnd = perthDatetimeLocalToIso("2026-07-20T07:59")!;
    const okEnd = perthDatetimeLocalToIso("2026-07-20T08:00")!;
    expect(validateLast24hBreakRange(start, shortEnd).ok).toBe(false);
    expect(validateLast24hBreakRange(start, okEnd).ok).toBe(true);
  });

  it("formats a readable Perth range", () => {
    const start = perthDatetimeLocalToIso("2026-07-19T14:00")!;
    const end = perthDatetimeLocalToIso("2026-07-20T14:00")!;
    expect(formatLast24hBreakRangeDisplay(start, end)).toMatch(/19/);
    expect(formatLast24hBreakRangeDisplay(start, end)).toMatch(/→/);
  });
});
