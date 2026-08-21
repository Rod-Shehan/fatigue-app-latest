import { describe, expect, it } from "vitest";
import { buildFrmsTimelinePayload, hashFrmsPayload } from "./build-timeline-payload";
import { RISK_BLOCK_MINUTES } from "@/lib/manager-risk-timeline";
import { getPerthMidnightUtcMs } from "@/lib/weeks";

describe("buildFrmsTimelinePayload", () => {
  it("emits chronological 15-minute blocks across the horizon", () => {
    const work = Array(1440).fill(false);
    work[600] = true;
    const days = JSON.stringify([
      { work_time: work, breaks: Array(1440).fill(false), non_work: Array(1440).fill(false) },
      ...Array(6).fill({
        work_time: Array(1440).fill(false),
        breaks: Array(1440).fill(false),
        non_work: Array(1440).fill(false),
      }),
    ]);
    const weekMap = new Map([["2026-05-31", { days }]]);
    const payload = buildFrmsTimelinePayload({
      driverName: "Test Driver",
      jurisdictionCode: "WA_OSH_3132",
      driverType: "solo",
      weekStarting: "2026-05-31",
      weekMap,
    });

    expect(payload.schema_version).toBe(1);
    expect(payload.timeline_blocks.length).toBeGreaterThan(0);
    const step = payload.timeline_blocks[1].start_ms - payload.timeline_blocks[0].start_ms;
    expect(step).toBe(RISK_BLOCK_MINUTES * 60 * 1000);
    expect(payload.horizon_from_ms).toBeLessThan(payload.as_of_ms);
    expect(payload.horizon_to_ms).toBeGreaterThan(payload.as_of_ms);
  });

  it("includes alertness_level on blocks for days with self-report", () => {
    const days = JSON.stringify([
      {
        work_time: Array(1440).fill(false),
        breaks: Array(1440).fill(false),
        non_work: Array(1440).fill(false),
        alertness_level: 5,
      },
      ...Array(6).fill({
        work_time: Array(1440).fill(false),
        breaks: Array(1440).fill(false),
        non_work: Array(1440).fill(false),
      }),
    ]);
    const weekStarting = "2026-08-16";
    const weekMap = new Map([[weekStarting, { days }]]);
    const payload = buildFrmsTimelinePayload({
      driverName: "Test Driver",
      jurisdictionCode: "WA_OSH_3132",
      driverType: "solo",
      weekStarting,
      weekMap,
    });
    const sundayBlock = payload.timeline_blocks.find(
      (b) => b.start_ms === getPerthMidnightUtcMs(weekStarting)
    );
    expect(sundayBlock?.alertness_level).toBe(5);
  });

  it("marks other_work overlay minutes as is_other_work, not driving", () => {
    const work = Array(1440).fill(false);
    const breaks = Array(1440).fill(false);
    const nonWork = Array(1440).fill(false);
    for (let m = 600; m < 615; m++) {
      work[m] = true;
      breaks[m] = true;
    }
    const days = JSON.stringify([
      { work_time: work, breaks, non_work: nonWork },
      ...Array(6).fill({
        work_time: Array(1440).fill(false),
        breaks: Array(1440).fill(false),
        non_work: Array(1440).fill(false),
      }),
    ]);
    const weekStarting = "2026-08-16";
    const weekMap = new Map([[weekStarting, { days }]]);
    const payload = buildFrmsTimelinePayload({
      driverName: "Test Driver",
      jurisdictionCode: "WA_OSH_3132",
      driverType: "solo",
      weekStarting,
      weekMap,
    });
    const blockStart = getPerthMidnightUtcMs(weekStarting) + 600 * 60 * 1000;
    const aligned = payload.timeline_blocks.find((b) => b.start_ms === blockStart);
    expect(aligned?.is_other_work).toBe(true);
    expect(aligned?.is_work).toBe(false);
    expect(aligned?.is_nap).toBe(false);
    expect(aligned?.sub_type).toBe("heavy_labor");
  });

  it("infers 7 h main sleep in a 12 h End shift → Work gap, not in the travel buffers", () => {
    const weekStarting = "2026-08-16";
    const emptyDay = {
      work_time: Array(1440).fill(false),
      breaks: Array(1440).fill(false),
      non_work: Array(1440).fill(false),
    };
    const days = JSON.stringify([
      {
        ...emptyDay,
        events: [{ time: "2026-08-16T18:00:00+08:00", type: "stop" }],
      },
      {
        ...emptyDay,
        events: [{ time: "2026-08-17T06:00:00+08:00", type: "work" }],
      },
      ...Array(5).fill(emptyDay),
    ]);
    const weekMap = new Map([[weekStarting, { days }]]);
    const payload = buildFrmsTimelinePayload({
      driverName: "Test Driver",
      jurisdictionCode: "WA_OSH_3132",
      driverType: "solo",
      weekStarting,
      weekMap,
    });
    const sunday = getPerthMidnightUtcMs(weekStarting);
    const afterKnockOff = payload.timeline_blocks.find((b) => b.start_ms === sunday + 18.25 * 60 * 60 * 1000);
    const sleepCore = payload.timeline_blocks.find((b) => b.start_ms === sunday + 23 * 60 * 60 * 1000);
    const commuteIn = payload.timeline_blocks.find((b) => b.start_ms === sunday + (24 + 5.75) * 60 * 60 * 1000);
    expect(afterKnockOff?.is_nap).toBe(false);
    expect(sleepCore?.is_nap).toBe(true);
    expect(sleepCore?.sub_type).toBe("nap");
    expect(commuteIn?.is_nap).toBe(false);
  });

  it("marks tagged Rest napFrom as is_nap without treating awake Rest as sleep", () => {
    const weekStarting = "2026-08-16";
    const emptyDay = {
      work_time: Array(1440).fill(false),
      breaks: Array(1440).fill(false),
      non_work: Array(1440).fill(false),
    };
    const napBreaks = Array(1440).fill(false);
    const awakeBreaks = Array(1440).fill(false);
    for (let m = 600; m < 660; m++) napBreaks[m] = true;
    for (let m = 720; m < 780; m++) awakeBreaks[m] = true;
    const days = JSON.stringify([
      {
        ...emptyDay,
        breaks: napBreaks.map((v, i) => v || awakeBreaks[i]),
        events: [
          { time: "2026-08-16T10:00:00+08:00", type: "break", napFrom: "2026-08-16T10:00:00+08:00" },
          { time: "2026-08-16T11:00:00+08:00", type: "work" },
          { time: "2026-08-16T12:00:00+08:00", type: "break" },
          { time: "2026-08-16T13:00:00+08:00", type: "work" },
        ],
      },
      ...Array(6).fill(emptyDay),
    ]);
    const weekMap = new Map([[weekStarting, { days }]]);
    const payload = buildFrmsTimelinePayload({
      driverName: "Test Driver",
      jurisdictionCode: "WA_OSH_3132",
      driverType: "solo",
      weekStarting,
      weekMap,
    });
    const sunday = getPerthMidnightUtcMs(weekStarting);
    const tagged = payload.timeline_blocks.find((b) => b.start_ms === sunday + 10.25 * 60 * 60 * 1000);
    const awake = payload.timeline_blocks.find((b) => b.start_ms === sunday + 12.25 * 60 * 60 * 1000);
    expect(tagged?.is_rest).toBe(true);
    expect(tagged?.is_nap).toBe(true);
    expect(tagged?.sub_type).toBe("nap");
    expect(awake?.is_rest).toBe(true);
    expect(awake?.is_nap).toBe(false);
    expect(awake?.sub_type).toBe("awake_rest");
  });

  it("hashFrmsPayload is stable for identical payloads", () => {
    const weekMap = new Map([["2026-05-31", { days: "[]" }]]);
    const a = buildFrmsTimelinePayload({
      driverName: "A",
      jurisdictionCode: "WA_OSH_3132",
      driverType: "solo",
      weekStarting: "2026-05-31",
      weekMap,
    });
    const b = buildFrmsTimelinePayload({
      driverName: "A",
      jurisdictionCode: "WA_OSH_3132",
      driverType: "solo",
      weekStarting: "2026-05-31",
      weekMap,
    });
    expect(hashFrmsPayload(a)).toBe(hashFrmsPayload(b));
  });
});
