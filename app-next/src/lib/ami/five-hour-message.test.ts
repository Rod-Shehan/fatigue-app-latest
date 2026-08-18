import { describe, expect, it } from "vitest";
import {
  fiveHourViolationDayAttribution,
  formatFiveHourRestDetail,
  formatFiveHourViolationMessage,
} from "./five-hour-message";

describe("five-hour violation copy", () => {
  it("says when there was no rest ≥10 min", () => {
    expect(formatFiveHourRestDetail([])).toBe("Last 5h work had no rest of 10 min or more.");
    expect(formatFiveHourRestDetail([9])).toBe(
      "Longest rest in that block: 9 min (need 20 min continuous, or two 10 min rests)."
    );
  });

  it("names a 19 min rest that did not complete 20 min", () => {
    expect(formatFiveHourRestDetail([19])).toBe(
      "Longest rest in that block: 19 min (need one more 10 min, or 20 min continuous)."
    );
  });

  it("names a single 10–19 min rest as needing one more 10", () => {
    expect(formatFiveHourRestDetail([12])).toBe(
      "Longest rest in that block: 12 min (need one more 10 min, or 20 min continuous)."
    );
  });

  it("puts clock time, work hours, and rest detail in the message (not AMI)", () => {
    const lastWorkMs = new Date(2026, 7, 16, 23, 24).getTime();
    const windowStartMs = new Date(2026, 7, 16, 17, 0).getTime();
    const msg = formatFiveHourViolationMessage({
      workMinutesInWindow: 354,
      restRunMinutes: [19],
      lastWorkMs,
      windowStartMs,
    });
    expect(msg).toContain("20 min rest per 5h work not met");
    expect(msg.toLowerCase()).not.toContain("ami");
    expect(msg).toContain("5.9h");
    expect(msg).toContain("19 min");
  });

  it("notes when the 5h work block started on a previous calendar day", () => {
    const msg = formatFiveHourViolationMessage({
      workMinutesInWindow: 360,
      restRunMinutes: [],
      lastWorkMs: new Date(2026, 7, 16, 2, 0).getTime(),
      windowStartMs: new Date(2026, 7, 15, 22, 0).getTime(),
    });
    expect(msg).toMatch(/From Sat 15 Aug/i);
  });

  it("attributes last work on this week to the weekday and scroll index", () => {
    const lastWorkMs = new Date(2026, 7, 16, 23, 24).getTime();
    expect(fiveHourViolationDayAttribution(lastWorkMs, "2026-08-16")).toEqual({
      day: "Sun",
      scrollDayIndex: 0,
    });
  });

  it("uses a calendar date when last work is not on the open week", () => {
    const lastWorkMs = new Date(2026, 7, 9, 12, 0).getTime();
    const attr = fiveHourViolationDayAttribution(lastWorkMs, "2026-08-16");
    expect(attr.scrollDayIndex).toBeUndefined();
    expect(attr.day).toMatch(/Sun 9 Aug/i);
  });
});
