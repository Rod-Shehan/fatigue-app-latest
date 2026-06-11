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
    const weekMap = new Map([["2026-06-07", { days }]]);
    const payload = buildFrmsTimelinePayload({
      driverName: "Test Driver",
      jurisdictionCode: "WA_OSH_3132",
      driverType: "solo",
      weekStarting: "2026-06-07",
      weekMap,
    });
    const sundayYmd = "2026-06-07";
    const sundayBlock = payload.timeline_blocks.find(
      (b) => b.start_ms === getPerthMidnightUtcMs(sundayYmd)
    );
    expect(sundayBlock?.alertness_level).toBe(5);
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
