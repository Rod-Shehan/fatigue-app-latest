import { describe, expect, it } from "vitest";
import {
  activityBeforeEvent,
  dayEventEditsBlocked,
  validateDayEventEdits,
} from "@/lib/day-event-edit-rules";

const t = (hhmm: string) => `2026-07-22T${hhmm}:00.000Z`;

describe("day-event-edit-rules", () => {
  it("blocks break in the middle of non-work", () => {
    const issues = validateDayEventEdits(
      [
        { time: t("08:00"), type: "non_work" },
        { time: t("10:00"), type: "break" },
        { time: t("12:00"), type: "non_work" },
      ],
      { activityBeforeDay: null }
    );
    expect(issues.some((i) => i.code === "break_without_work")).toBe(true);
    expect(dayEventEditsBlocked(issues)).toBe(true);
  });

  it("allows break after work", () => {
    const issues = validateDayEventEdits(
      [
        { time: t("08:00"), type: "work" },
        { time: t("10:00"), type: "break" },
        { time: t("10:20"), type: "work" },
      ],
      { activityBeforeDay: null }
    );
    expect(issues).toEqual([]);
  });

  it("allows break when prior day left open work", () => {
    const issues = validateDayEventEdits([{ time: t("00:30"), type: "break" }], {
      activityBeforeDay: "work",
    });
    // open break at end still blocked
    expect(issues.some((i) => i.code === "open_break_at_end")).toBe(true);
    expect(issues.some((i) => i.code === "break_without_work")).toBe(false);
  });

  it("blocks break as first event with no prior open work", () => {
    const issues = validateDayEventEdits([{ time: t("09:00"), type: "break" }, { time: t("09:20"), type: "work" }], {
      activityBeforeDay: null,
    });
    expect(issues.some((i) => i.code === "break_without_work")).toBe(true);
  });

  it("blocks break after End shift", () => {
    const issues = validateDayEventEdits(
      [
        { time: t("08:00"), type: "work" },
        { time: t("16:00"), type: "stop" },
        { time: t("16:30"), type: "break" },
        { time: t("17:00"), type: "non_work" },
      ],
      { activityBeforeDay: null }
    );
    expect(issues.some((i) => i.code === "break_without_work")).toBe(true);
  });

  it("blocks End shift without work/break", () => {
    const issues = validateDayEventEdits(
      [
        { time: t("08:00"), type: "non_work" },
        { time: t("16:00"), type: "stop" },
      ],
      { activityBeforeDay: null }
    );
    expect(issues.some((i) => i.code === "end_shift_without_work")).toBe(true);
  });

  it("allows open work at end of day (overnight continue)", () => {
    const issues = validateDayEventEdits([{ time: t("22:00"), type: "work" }], {
      activityBeforeDay: null,
    });
    expect(issues).toEqual([]);
  });

  it("blocks open break as last event", () => {
    const issues = validateDayEventEdits(
      [
        { time: t("08:00"), type: "work" },
        { time: t("12:00"), type: "break" },
      ],
      { activityBeforeDay: null }
    );
    expect(issues.some((i) => i.code === "open_break_at_end")).toBe(true);
  });

  it("blocks consecutive duplicate types", () => {
    const issues = validateDayEventEdits(
      [
        { time: t("08:00"), type: "work" },
        { time: t("09:00"), type: "work" },
      ],
      { activityBeforeDay: null }
    );
    expect(issues.some((i) => i.code === "duplicate_consecutive")).toBe(true);
  });

  it("activityBeforeEvent uses prior day for first event", () => {
    expect(activityBeforeEvent([{ time: t("01:00"), type: "break" }], 0, "work")).toBe("work");
    expect(activityBeforeEvent([{ time: t("01:00"), type: "break" }], 0, null)).toBe(null);
  });
});
