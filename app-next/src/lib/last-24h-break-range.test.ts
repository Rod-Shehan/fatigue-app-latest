import { describe, expect, it } from "vitest";
import {
  formatLast24hBreakRangeDisplay,
  isoToPerthDatetimeLocal,
  perthDatetimeLocalToIso,
  validateLast24hBreakRange,
} from "./last-24h-break-range";

describe("last-24h-break-range", () => {
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
