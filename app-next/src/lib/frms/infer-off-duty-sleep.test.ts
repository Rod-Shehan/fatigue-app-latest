import { describe, expect, it } from "vitest";
import {
  FRMS_COMMUTE_EACH_WAY_MS,
  FRMS_HOME_DUTIES_MS,
  FRMS_MAIN_SLEEP_CAP_MS,
  inferClosedOffDutySleepWindows,
  inferMainSleepWindowsFromEvents,
  inferOpenOffDutySleepWindows,
} from "./infer-off-duty-sleep";

const HOUR = 60 * 60 * 1000;

describe("inferClosedOffDutySleepWindows", () => {
  it("on a 12 h knock-off is 4 h home after 30 min travel, then 7 h sleep, then 30 min drive in", () => {
    const start = Date.parse("2026-08-16T18:00:00+08:00");
    const end = start + 12 * HOUR;
    const windows = inferClosedOffDutySleepWindows(start, end);
    expect(windows).toHaveLength(1);
    expect(windows[0].startMs).toBe(start + FRMS_COMMUTE_EACH_WAY_MS + FRMS_HOME_DUTIES_MS);
    expect(windows[0].endMs - windows[0].startMs).toBe(FRMS_MAIN_SLEEP_CAP_MS);
    expect(windows[0].endMs).toBe(end - FRMS_COMMUTE_EACH_WAY_MS);
  });

  it("does not infer sleep on a 90 minute gap", () => {
    const start = Date.parse("2026-08-16T18:00:00+08:00");
    expect(inferClosedOffDutySleepWindows(start, start + 90 * 60 * 1000)).toEqual([]);
  });

  it("on an 8 h gap uses 7 h sleep with only travel buffers (no home)", () => {
    const start = Date.parse("2026-08-16T22:00:00+08:00");
    const end = start + 8 * HOUR;
    const windows = inferClosedOffDutySleepWindows(start, end);
    expect(windows).toHaveLength(1);
    expect(windows[0].startMs).toBe(start + FRMS_COMMUTE_EACH_WAY_MS);
    expect(windows[0].endMs).toBe(end - FRMS_COMMUTE_EACH_WAY_MS);
    expect(windows[0].endMs - windows[0].startMs).toBe(7 * HOUR);
  });

  it("tiles further 7 h nights on a long weekend off", () => {
    const start = Date.parse("2026-08-14T18:00:00+08:00");
    const end = Date.parse("2026-08-17T06:00:00+08:00"); // 60 h
    const windows = inferClosedOffDutySleepWindows(start, end);
    expect(windows.length).toBe(3);
    expect(windows[0].endMs - windows[0].startMs).toBe(FRMS_MAIN_SLEEP_CAP_MS);
    expect(windows[2].endMs).toBe(end - FRMS_COMMUTE_EACH_WAY_MS);
  });
});

describe("inferOpenOffDutySleepWindows", () => {
  it("starts the first night after 30 min travel plus 4 h home", () => {
    const start = Date.parse("2026-08-16T18:00:00+08:00");
    const windows = inferOpenOffDutySleepWindows(start, start + 12 * HOUR);
    expect(windows).toHaveLength(1);
    expect(windows[0].startMs).toBe(start + FRMS_COMMUTE_EACH_WAY_MS + FRMS_HOME_DUTIES_MS);
    expect(windows[0].endMs - windows[0].startMs).toBe(FRMS_MAIN_SLEEP_CAP_MS);
  });
});

describe("inferMainSleepWindowsFromEvents", () => {
  it("uses End shift → Work, not a long Rest without stop", () => {
    const stop = "2026-08-16T18:00:00+08:00";
    const work = "2026-08-17T06:00:00+08:00";
    const fromStop = inferMainSleepWindowsFromEvents(
      [
        { time: stop, type: "stop" },
        { time: work, type: "work" },
      ],
      Date.parse(work)
    );
    expect(fromStop).toHaveLength(1);

    const restOnly = inferMainSleepWindowsFromEvents(
      [
        { time: "2026-08-16T12:00:00+08:00", type: "break" },
        { time: "2026-08-16T13:00:00+08:00", type: "work" },
      ],
      Date.parse(work)
    );
    expect(restOnly).toEqual([]);
  });
});
