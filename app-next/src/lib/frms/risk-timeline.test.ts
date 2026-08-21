import { describe, expect, it } from "vitest";
import {
  FRMS_TIMELINE_MIN_SNAPSHOTS,
  mergeFrmsSnapshotsWithLiveBlocks,
} from "@/lib/frms/risk-timeline";
import { findNowBlockStartMs, RISK_BLOCK_MINUTES } from "@/lib/manager-risk-timeline";

describe("mergeFrmsSnapshotsWithLiveBlocks", () => {
  const blockMs = RISK_BLOCK_MINUTES * 60 * 1000;
  const nowBlock = findNowBlockStartMs(Date.UTC(2026, 5, 5, 14, 0, 0));
  const pastBlock = nowBlock - blockMs;
  const futureBlock = nowBlock + blockMs;

  it("maps combinedPct to baseline and recovers the biological floor from TSI", () => {
    const series = mergeFrmsSnapshotsWithLiveBlocks(
      "Rod Shehan",
      [
        { blockStartMs: BigInt(pastBlock), combinedPct: 58, processSPct: 30, processCPct: 20, modelPct: 80, band: "monitor" },
        { blockStartMs: BigInt(nowBlock), combinedPct: 55, processSPct: 40, processCPct: 25, band: "elevated" },
        { blockStartMs: BigInt(futureBlock), combinedPct: 38, processSPct: 25, processCPct: 18, band: "monitor" },
      ],
      [],
      { nowMs: nowBlock + 1 }
    );

    expect(series.blocks).toHaveLength(3);
    expect(series.blocks[0].baselinePct).toBe(58);
    expect(series.blocks[0].biologicalPct).toBeLessThan(58);
    expect(series.blocks[0].livePct).toBe(58);
    expect(series.blocks[2].livePct).toBeUndefined();
    expect(series.blocks[1].isNow).toBe(true);
  });

  it("prefers DriverRiskBlock livePct and marks camera fusion", () => {
    const series = mergeFrmsSnapshotsWithLiveBlocks(
      "Rod Shehan",
      [{ blockStartMs: BigInt(nowBlock), combinedPct: 40, processSPct: 30, processCPct: 15, band: "monitor" }],
      [
        {
          blockStartMs: BigInt(nowBlock),
          baselinePct: 40,
          livePct: 68,
          fusionSources: ["camera", "diary"],
          cameraPayload: {},
          diaryContext: null,
        },
      ],
      { nowMs: nowBlock + 1 }
    );

    expect(series.blocks[0].livePct).toBe(68);
    expect(series.blocks[0].hasCamera).toBe(true);
  });

  it("requires minimum snapshot count threshold constant", () => {
    expect(FRMS_TIMELINE_MIN_SNAPSHOTS).toBeGreaterThanOrEqual(8);
  });
});
