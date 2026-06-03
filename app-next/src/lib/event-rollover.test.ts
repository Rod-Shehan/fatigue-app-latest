import { describe, expect, it } from "vitest";
import {
  deriveDaysWithRollover,
  getEffectiveOpenActivityAtDayEnd,
} from "@/components/fatigue/EventLogger";
import { MINUTES_PER_DAY } from "@/lib/coverage/derive-minute-coverage";

const WEEK_START = "2026-06-01"; // Sunday … Saturday 2026-06-07

describe("getEffectiveOpenActivityAtDayEnd", () => {
  it("returns non_work when last event is non_work (not stop)", () => {
    const t = getEffectiveOpenActivityAtDayEnd(
      {
        events: [{ time: "2026-06-03T20:00:00", type: "non_work" }],
      },
      "2026-06-03",
      "2026-06-04"
    );
    expect(t).toBe("non_work");
  });

  it("returns null after End shift", () => {
    const t = getEffectiveOpenActivityAtDayEnd(
      {
        events: [
          { time: "2026-06-03T08:00:00", type: "work" },
          { time: "2026-06-03T18:00:00", type: "stop" },
        ],
      },
      "2026-06-03",
      "2026-06-04"
    );
    expect(t).toBeNull();
  });
});

describe("deriveDaysWithRollover", () => {
  it("carries non_work from Tuesday into Wednesday until first event", () => {
    const days = [
      {},
      {},
      {
        events: [{ time: "2026-06-03T22:00:00", type: "non_work" }],
      },
      { events: [] },
    ];
    const derived = deriveDaysWithRollover(days, WEEK_START, { todayStr: "2026-06-05" });
    const wed = derived[3]!;
    const workMins = (wed.work_time ?? []).filter(Boolean).length;
    const nonWorkMins = (wed.non_work ?? []).filter(Boolean).length;
    expect(workMins).toBe(0);
    expect(nonWorkMins).toBe(MINUTES_PER_DAY);
  });

  it("does not carry work into Wednesday until driver logs work that day", () => {
    const days = [
      {},
      {},
      {
        events: [{ time: "2026-06-03T22:00:00", type: "work" }],
      },
      { events: [] },
    ];
    const derived = deriveDaysWithRollover(days, WEEK_START, { todayStr: "2026-06-05" });
    const wed = derived[3]!;
    expect((wed.work_time ?? []).filter(Boolean).length).toBe(0);
    expect((wed.non_work ?? []).filter(Boolean).length).toBe(MINUTES_PER_DAY);
  });

  it("carries work across midnight after driver logs work on the new day", () => {
    const days = [
      {},
      {},
      { events: [{ time: "2026-06-03T22:00:00", type: "work" }] },
      { events: [{ time: "2026-06-04T06:00:00", type: "work" }] },
    ];
    const derived = deriveDaysWithRollover(days, WEEK_START, { todayStr: "2026-06-05" });
    const wed = derived[3]!;
    expect((wed.work_time ?? []).filter(Boolean).length).toBeGreaterThan(0);
  });

  it("does not fill Wednesday as work when Tuesday ended with non_work and open work grid tail", () => {
    const tuesday = deriveDaysWithRollover(
      [
        {},
        {},
        { events: [{ time: "2026-06-03T18:00:00", type: "non_work" }] },
        {},
      ],
      WEEK_START,
      { todayStr: "2026-06-05" }
    )[2]!;
    const wed = deriveDaysWithRollover(
      [
        {},
        {},
        tuesday,
        { events: [] },
      ],
      WEEK_START,
      { todayStr: "2026-06-05" }
    )[3]!;
    const firstHourWork = (wed.work_time ?? []).slice(0, 60).some(Boolean);
    const firstHourNonWork = (wed.non_work ?? []).slice(0, 60).some(Boolean);
    expect(firstHourWork).toBe(false);
    expect(firstHourNonWork).toBe(true);
  });
});
