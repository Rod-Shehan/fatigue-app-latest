import { describe, expect, it } from "vitest";
import {
  deriveDaysWithRollover,
  getEffectiveOpenActivityAtDayEnd,
  resolveOpenActivityBeforeFirstDay,
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

  it("returns non_work after End shift so coverage continues until the next event", () => {
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
    expect(t).toBe("non_work");
  });

  it("returns other_work so overnight loading is not converted as Rest", () => {
    const t = getEffectiveOpenActivityAtDayEnd(
      {
        events: [
          { time: "2026-06-03T08:00:00", type: "work" },
          { time: "2026-06-03T22:00:00", type: "other_work" },
        ],
      },
      "2026-06-03",
      "2026-06-04"
    );
    expect(t).toBe("other_work");
  });

  it("carries passenger as other_work so it never converts to non-work at midnight", () => {
    const t = getEffectiveOpenActivityAtDayEnd(
      {
        events: [
          { time: "2026-06-03T08:00:00", type: "work" },
          { time: "2026-06-03T22:00:00", type: "passenger" },
        ],
      },
      "2026-06-03",
      "2026-06-04"
    );
    expect(t).toBe("other_work");
  });

  it("carries sleeper berth as non-work; shift stayed open (not End shift)", () => {
    const t = getEffectiveOpenActivityAtDayEnd(
      {
        events: [
          { time: "2026-06-03T08:00:00", type: "work" },
          { time: "2026-06-03T22:00:00", type: "sleeper_berth" },
        ],
      },
      "2026-06-03",
      "2026-06-04"
    );
    expect(t).toBe("non_work");
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

  it("carries open work across midnight without requiring a new-day work tap", () => {
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
    expect((wed.work_time ?? []).filter(Boolean).length).toBe(MINUTES_PER_DAY);
    expect((wed.non_work ?? []).filter(Boolean).length).toBe(0);
  });

  it("carries open break across midnight until the next driver event", () => {
    const days = [
      {},
      {},
      { events: [{ time: "2026-06-03T23:50:00", type: "break" }] },
      { events: [{ time: "2026-06-04T00:15:00", type: "work" }] },
    ];
    const derived = deriveDaysWithRollover(days, WEEK_START, { todayStr: "2026-06-05" });
    const wed = derived[3]!;
    // Actioned break carry stays break (≤30m); then work from the driver's next tap
    expect((wed.breaks ?? []).slice(0, 15).every(Boolean)).toBe(true);
    expect((wed.work_time ?? []).slice(15, 60).every(Boolean)).toBe(true);
  });

  it("carries open other_work across midnight as break-from-driving, never non-work", () => {
    const days = [
      {},
      {},
      { events: [{ time: "2026-06-03T22:00:00", type: "other_work" }] },
      { events: [] },
    ];
    const derived = deriveDaysWithRollover(days, WEEK_START, { todayStr: "2026-06-05" });
    const wed = derived[3]!;
    expect((wed.breaks ?? []).filter(Boolean).length).toBe(MINUTES_PER_DAY);
    expect((wed.work_time ?? []).filter(Boolean).length).toBe(MINUTES_PER_DAY);
    expect((wed.non_work ?? []).filter(Boolean).length).toBe(0);
  });

  it("carries open passenger across midnight as break-from-driving, never non-work", () => {
    const days = [
      {},
      {},
      { events: [{ time: "2026-06-03T22:00:00", type: "passenger" }] },
      { events: [] },
    ];
    const derived = deriveDaysWithRollover(days, WEEK_START, { todayStr: "2026-06-05" });
    const wed = derived[3]!;
    expect((wed.breaks ?? []).filter(Boolean).length).toBe(MINUTES_PER_DAY);
    expect((wed.work_time ?? []).filter(Boolean).length).toBe(MINUTES_PER_DAY);
    expect((wed.non_work ?? []).filter(Boolean).length).toBe(0);
  });

  it("carries open sleeper berth across midnight as non-work (shift still open)", () => {
    const days = [
      {},
      {},
      { events: [{ time: "2026-06-03T22:00:00", type: "sleeper_berth" }] },
      { events: [] },
    ];
    const derived = deriveDaysWithRollover(days, WEEK_START, { todayStr: "2026-06-05" });
    const wed = derived[3]!;
    expect((wed.non_work ?? []).filter(Boolean).length).toBe(MINUTES_PER_DAY);
    expect((wed.work_time ?? []).filter(Boolean).length).toBe(0);
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
    // Continuous work from midnight through the tap (driver type never cut)
    expect((wed.work_time ?? []).slice(0, 6 * 60).every(Boolean)).toBe(true);
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

  it("carries open work from prior week Saturday into Sunday (weekStarting is UI only)", () => {
    const prevWeekDays = [
      {},
      {},
      {},
      {},
      {},
      {},
      { events: [{ time: "2026-05-30T22:00:00", type: "work" }] },
    ];
    const openBefore = resolveOpenActivityBeforeFirstDay(prevWeekDays, "2026-05-25", "2026-06-05");
    expect(openBefore).toBe("work");

    const thisWeek = [{ events: [] as { time: string; type: string }[] }, {}, {}, {}, {}, {}, {}];
    const derived = deriveDaysWithRollover(thisWeek, WEEK_START, {
      todayStr: "2026-06-05",
      openActivityBeforeFirstDay: openBefore,
    });
    expect((derived[0]!.work_time ?? []).filter(Boolean).length).toBe(MINUTES_PER_DAY);
  });

  it("continues non-work after End shift across midnight until the next driver event", () => {
    const days = [
      {},
      {},
      {},
      {},
      {
        events: [
          { time: "2026-06-04T08:00:00", type: "work" },
          { time: "2026-06-04T16:00:00", type: "stop" },
        ],
      },
      { events: [] },
    ];
    const derived = deriveDaysWithRollover(days, WEEK_START, { todayStr: "2026-06-06" });
    const thu = derived[4]!;
    const fri = derived[5]!;
    expect((thu.work_time ?? []).slice(16 * 60).some(Boolean)).toBe(false);
    expect((thu.non_work ?? []).slice(16 * 60).every(Boolean)).toBe(true);
    expect((fri.work_time ?? []).some(Boolean)).toBe(false);
    expect((fri.non_work ?? []).every(Boolean)).toBe(true);
    expect((thu.non_work ?? [])[MINUTES_PER_DAY - 1]).toBe(true);
    expect((fri.non_work ?? [])[0]).toBe(true);
  });

  it("carries non-work from prior week Saturday End shift into Sunday (weekStarting is UI only)", () => {
    const prevWeekDays = [
      {},
      {},
      {},
      {},
      {},
      {},
      {
        events: [
          { time: "2026-05-30T08:00:00", type: "work" },
          { time: "2026-05-30T18:00:00", type: "stop" },
        ],
      },
    ];
    const openBefore = resolveOpenActivityBeforeFirstDay(prevWeekDays, "2026-05-25", "2026-06-05");
    expect(openBefore).toBe("non_work");

    const thisWeek = [{ events: [] as { time: string; type: string }[] }, {}, {}, {}, {}, {}, {}];
    const derived = deriveDaysWithRollover(thisWeek, WEEK_START, {
      todayStr: "2026-06-05",
      openActivityBeforeFirstDay: openBefore,
    });
    expect((derived[0]!.non_work ?? []).filter(Boolean).length).toBe(MINUTES_PER_DAY);
    expect((derived[0]!.work_time ?? []).some(Boolean)).toBe(false);
  });
});
