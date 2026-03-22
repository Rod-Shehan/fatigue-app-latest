import { describe, expect, it } from "vitest";
import {
  formatLast24hBreakDisplay,
  getLast24hBreakCalendarDate,
  isDayOnOrAfterBreakCalendar,
  last24hBreakHasTime,
  last24hBreakToDatetimeLocalValue,
  parseLast24hBreak,
  trimNonWorkAfterBreakEnd,
} from "./last-24h-break";
import { applyLast24hBreakNonWorkRule } from "@/components/fatigue/EventLogger";

describe("parseLast24hBreak", () => {
  it("parses legacy date-only as end of that local calendar day", () => {
    const p = parseLast24hBreak("2026-03-22");
    expect(p).not.toBeNull();
    expect(p!.calendarDate).toBe("2026-03-22");
    expect(p!.hasTime).toBe(false);
    const d = new Date(p!.breakEndMs);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(22);
    expect(d.getHours()).toBe(23);
  });

  it("parses datetime-local style string", () => {
    const p = parseLast24hBreak("2026-03-22T08:00");
    expect(p).not.toBeNull();
    expect(p!.calendarDate).toBe("2026-03-22");
    expect(p!.hasTime).toBe(true);
    const d = new Date(p!.breakEndMs);
    expect(d.getHours()).toBe(8);
    expect(d.getMinutes()).toBe(0);
  });
});

describe("getLast24hBreakCalendarDate", () => {
  it("extracts date from datetime string", () => {
    expect(getLast24hBreakCalendarDate("2026-03-22T08:00")).toBe("2026-03-22");
  });
});

describe("last24hBreakHasTime", () => {
  it("is false for date-only", () => {
    expect(last24hBreakHasTime("2026-03-22")).toBe(false);
  });
  it("is true for datetime-local", () => {
    expect(last24hBreakHasTime("2026-03-22T08:00")).toBe(true);
  });
});

describe("isDayOnOrAfterBreakCalendar", () => {
  it("treats same calendar day as on-or-after for datetime (no lexicographic bug)", () => {
    expect(isDayOnOrAfterBreakCalendar("2026-03-22", "2026-03-22T08:00")).toBe(true);
    expect(isDayOnOrAfterBreakCalendar("2026-03-21", "2026-03-22T08:00")).toBe(false);
  });
});

describe("trimNonWorkAfterBreakEnd", () => {
  it("clears non_work from slot start >= break end when day has no work", () => {
    const parsed = parseLast24hBreak("2026-03-22T08:00")!;
    const day = { work_time: Array(48).fill(false), non_work: Array(48).fill(true) };
    const out = trimNonWorkAfterBreakEnd(day, "2026-03-22", parsed);
    // 08:00 = slot 16
    expect(out.non_work!.slice(0, 16).every(Boolean)).toBe(true);
    expect(out.non_work!.slice(16).every((x) => !x)).toBe(true);
  });
});

describe("applyLast24hBreakNonWorkRule", () => {
  const weekStarting = "2026-03-21"; // Sunday

  it("with datetime, does not strip Sunday non-work when break is Monday morning", () => {
    const sunNw = Array(48).fill(true);
    const monNw = Array(48).fill(true);
    const days = [
      { work_time: Array(48).fill(false), non_work: [...sunNw] },
      { work_time: Array(48).fill(false), non_work: [...monNw] },
    ];
    const out = applyLast24hBreakNonWorkRule(days, weekStarting, "2026-03-22T08:00");
    expect(out[0].non_work!.some(Boolean)).toBe(true);
    expect(out[1].non_work!.slice(0, 16).every(Boolean)).toBe(true);
    expect(out[1].non_work!.slice(16).every((x) => !x)).toBe(true);
  });

  it("with date-only, still clears prior days with no work", () => {
    const days = [
      { work_time: Array(48).fill(false), non_work: Array(48).fill(true) },
      { work_time: Array(48).fill(false), non_work: Array(48).fill(true) },
    ];
    const out = applyLast24hBreakNonWorkRule(days, weekStarting, "2026-03-22");
    expect(out[0].non_work!.every((x) => !x)).toBe(true);
    expect(out[1].non_work!.some(Boolean)).toBe(true);
  });
});

describe("formatLast24hBreakDisplay", () => {
  it("formats date-only without time", () => {
    const s = formatLast24hBreakDisplay("2026-03-22");
    expect(s).toMatch(/2026/);
    expect(s).toMatch(/Mar/);
  });
});

describe("last24hBreakToDatetimeLocalValue", () => {
  it("maps legacy date to T00:00 for inputs", () => {
    expect(last24hBreakToDatetimeLocalValue("2026-03-22")).toMatch(/^2026-03-22T00:00$/);
  });
});
