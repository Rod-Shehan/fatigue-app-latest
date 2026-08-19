import { describe, it, expect } from "vitest";
import { MINUTES_PER_DAY } from "@/lib/coverage/derive-minute-coverage";
import {
  buildWorkSafeDayPaint,
  exclusiveTrackAtMinute,
  segmentsFromTrackByMinute,
  WORKSAFE_TRACK_LABELS,
} from "./index";

const PAST = "2099-06-01";
const TODAY = "2099-12-31";

function trackAt(paint: ReturnType<typeof buildWorkSafeDayPaint>, startMin: number, endMin: number) {
  return paint.trackByMinute.slice(startMin, endMin);
}

describe("WORKSAFE_TRACK_LABELS", () => {
  it("uses WorkSafe paper row wording", () => {
    expect(WORKSAFE_TRACK_LABELS.work).toBe("WORK TIME");
    expect(WORKSAFE_TRACK_LABELS.break).toBe("BREAKS FROM DRIVING");
    expect(WORKSAFE_TRACK_LABELS.non_work).toBe("NON WORK TIME");
  });
});

describe("exclusiveTrackAtMinute", () => {
  it("masks work when break is also set (exclusive tracks)", () => {
    const work = Array(MINUTES_PER_DAY).fill(false);
    const breaks = Array(MINUTES_PER_DAY).fill(false);
    const non_work = Array(MINUTES_PER_DAY).fill(false);
    work[10] = true;
    breaks[10] = true;
    expect(exclusiveTrackAtMinute(work, breaks, non_work, 10)).toBe("break");
  });
});

describe("buildWorkSafeDayPaint", () => {
  it("maps work → break → work to exclusive tracks and step segments", () => {
    const paint = buildWorkSafeDayPaint({
      dateStr: PAST,
      todayStr: TODAY,
      events: [
        { time: `${PAST}T08:00:00`, type: "work" },
        { time: `${PAST}T12:00:00`, type: "break" },
        { time: `${PAST}T12:20:00`, type: "work" },
        { time: `${PAST}T16:00:00`, type: "stop" },
      ],
    });

    expect(trackAt(paint, 8 * 60, 12 * 60).every((t) => t === "work")).toBe(true);
    expect(trackAt(paint, 12 * 60, 12 * 60 + 20).every((t) => t === "break")).toBe(true);
    expect(trackAt(paint, 12 * 60 + 20, 16 * 60).every((t) => t === "work")).toBe(true);
    expect(trackAt(paint, 16 * 60, MINUTES_PER_DAY).every((t) => t === "non_work")).toBe(true);

    expect(paint.totalsMinutes.break).toBe(20);
    expect(paint.totalsMinutes.work).toBe(4 * 60 + 3 * 60 + 40); // 08–12 + 12:20–16
    expect(paint.segments.some((s) => s.track === "break" && s.startMin === 720 && s.endMin === 740)).toBe(
      true
    );
  });

  it("paints End shift gap as non_work (never invented break)", () => {
    const paint = buildWorkSafeDayPaint({
      dateStr: PAST,
      todayStr: TODAY,
      events: [
        { time: `${PAST}T08:00:00`, type: "work" },
        { time: `${PAST}T12:00:00`, type: "stop" },
        { time: `${PAST}T12:20:00`, type: "work" },
        { time: `${PAST}T14:00:00`, type: "stop" },
      ],
    });

    expect(trackAt(paint, 12 * 60, 12 * 60 + 20).every((t) => t === "non_work")).toBe(true);
    expect(paint.trackByMinute.slice(12 * 60, 12 * 60 + 20).some((t) => t === "break")).toBe(false);
  });

  it("reclassifies long logged break (≥31 min) as non_work", () => {
    const paint = buildWorkSafeDayPaint({
      dateStr: PAST,
      todayStr: TODAY,
      events: [
        { time: `${PAST}T08:00:00`, type: "work" },
        { time: `${PAST}T10:00:00`, type: "break" },
        { time: `${PAST}T11:00:00`, type: "work" },
        { time: `${PAST}T12:00:00`, type: "stop" },
      ],
    });

    expect(trackAt(paint, 10 * 60, 11 * 60).every((t) => t === "non_work")).toBe(true);
    expect(paint.totalsMinutes.break).toBe(0);
    expect(paint.totalsMinutes.non_work).toBeGreaterThanOrEqual(60);
  });

  it("paints 45 min other_work as BREAKS FROM DRIVING, not non_work", () => {
    const paint = buildWorkSafeDayPaint({
      dateStr: PAST,
      todayStr: TODAY,
      events: [
        { time: `${PAST}T08:00:00`, type: "work" },
        { time: `${PAST}T10:00:00`, type: "other_work" },
        { time: `${PAST}T10:45:00`, type: "work" },
        { time: `${PAST}T12:00:00`, type: "stop" },
      ],
    });

    expect(trackAt(paint, 10 * 60, 10 * 60 + 45).every((t) => t === "break")).toBe(true);
    expect(trackAt(paint, 10 * 60, 10 * 60 + 45).some((t) => t === "non_work")).toBe(false);
    expect(paint.totalsMinutes.break).toBe(45);
  });

  it("continues overnight carry as the same track until next event", () => {
    const paint = buildWorkSafeDayPaint({
      dateStr: PAST,
      todayStr: TODAY,
      carryOverType: "work",
      carryOverEndMinute: 6 * 60,
      events: [
        { time: `${PAST}T06:00:00`, type: "break" },
        { time: `${PAST}T06:15:00`, type: "work" },
        { time: `${PAST}T10:00:00`, type: "stop" },
      ],
    });

    expect(trackAt(paint, 0, 6 * 60).every((t) => t === "work")).toBe(true);
    expect(trackAt(paint, 6 * 60, 6 * 60 + 15).every((t) => t === "break")).toBe(true);
  });

  it("leaves future days fully unpainted", () => {
    const paint = buildWorkSafeDayPaint({
      dateStr: "2100-01-01",
      todayStr: TODAY,
      events: [{ time: `2100-01-01T08:00:00`, type: "work" }],
    });
    expect(paint.paintedUntilMinute).toBe(0);
    expect(paint.trackByMinute.every((t) => t == null)).toBe(true);
    expect(paint.segments).toEqual([]);
    expect(paint.totalsMinutes).toEqual({ work: 0, break: 0, non_work: 0 });
  });

  it("builds segments from track runs", () => {
    const tracks = Array(10).fill(null) as Array<"work" | "break" | "non_work" | null>;
    tracks[2] = "work";
    tracks[3] = "work";
    tracks[4] = "break";
    expect(segmentsFromTrackByMinute(tracks)).toEqual([
      { track: "work", startMin: 2, endMin: 4 },
      { track: "break", startMin: 4, endMin: 5 },
    ]);
  });

  it("accepts precomputed grids (sheet / rollover path)", () => {
    const work_time = Array(MINUTES_PER_DAY).fill(false);
    const breaks = Array(MINUTES_PER_DAY).fill(false);
    const non_work = Array(MINUTES_PER_DAY).fill(false);
    for (let m = 0; m < 60; m++) work_time[m] = true;
    for (let m = 60; m < 80; m++) breaks[m] = true;
    for (let m = 80; m < MINUTES_PER_DAY; m++) non_work[m] = true;

    const paint = buildWorkSafeDayPaint({
      dateStr: PAST,
      todayStr: TODAY,
      work_time,
      breaks,
      non_work,
    });
    expect(paint.totalsMinutes.work).toBe(60);
    expect(paint.totalsMinutes.break).toBe(20);
    expect(paint.totalsMinutes.non_work).toBe(MINUTES_PER_DAY - 80);
  });

  it("fills empty past days (all-false grids, no events) as 24h non_work", () => {
    const empty = Array(MINUTES_PER_DAY).fill(false);
    const paint = buildWorkSafeDayPaint({
      dateStr: PAST,
      todayStr: TODAY,
      work_time: empty,
      breaks: empty,
      non_work: empty,
      events: [],
    });
    expect(paint.paintedUntilMinute).toBe(MINUTES_PER_DAY);
    expect(paint.trackByMinute.every((t) => t === "non_work")).toBe(true);
    expect(paint.totalsMinutes).toEqual({ work: 0, break: 0, non_work: MINUTES_PER_DAY });
    expect(paint.segments).toEqual([{ track: "non_work", startMin: 0, endMin: MINUTES_PER_DAY }]);
  });

  it("does not invent non_work for coverage gaps when the day already has activity", () => {
    const work_time = Array(MINUTES_PER_DAY).fill(false);
    const breaks = Array(MINUTES_PER_DAY).fill(false);
    const non_work = Array(MINUTES_PER_DAY).fill(false);
    for (let m = 60; m < 120; m++) work_time[m] = true;
    const paint = buildWorkSafeDayPaint({
      dateStr: PAST,
      todayStr: TODAY,
      work_time,
      breaks,
      non_work,
      events: [{ time: `${PAST}T01:00:00`, type: "work" }],
    });
    expect(trackAt(paint, 0, 60).every((t) => t == null)).toBe(true);
    expect(trackAt(paint, 60, 120).every((t) => t === "work")).toBe(true);
    expect(paint.totalsMinutes.work).toBe(60);
    expect(paint.totalsMinutes.non_work).toBe(0);
  });
});
