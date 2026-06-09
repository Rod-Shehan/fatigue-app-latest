import { describe, expect, it } from "vitest";
import {
  buildFleetPriorityQueue,
  fleetDriverNeedsManagerAttention,
  fleetHeatmapLabelIndices,
  fleetWorstNowDriver,
  findFleetNowIndex,
  partitionFleetDrivers,
  pickHighestCurrentRiskDriver,
  type FleetDriverRiskRow,
  type FleetRiskCell,
} from "@/lib/frms/fleet-risk-timeline";

describe("fleetHeatmapLabelIndices", () => {
  it("returns all indices for small windows", () => {
    expect(fleetHeatmapLabelIndices(4)).toEqual([0, 1, 2, 3]);
  });

  it("samples evenly for long windows", () => {
    const indices = fleetHeatmapLabelIndices(45);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(44);
    expect(indices.length).toBeGreaterThan(3);
  });
});

describe("fleetDriverNeedsManagerAttention", () => {
  const row = (now: number | null, peak: number | null): FleetDriverRiskRow => ({
    driverName: "T",
    scoring_engine: "frms",
    nowPct: now,
    peakNext24Pct: peak,
    cells: [],
  });

  it("flags when now or peak meets TPMA elevated threshold (55%)", () => {
    expect(fleetDriverNeedsManagerAttention(row(54, 10))).toBe(false);
    expect(fleetDriverNeedsManagerAttention(row(55, 10))).toBe(true);
    expect(fleetDriverNeedsManagerAttention(row(10, 55))).toBe(true);
  });
});

describe("partitionFleetDrivers", () => {
  it("splits actionable vs below threshold", () => {
    const { actionable, belowThreshold, summary } = partitionFleetDrivers([
      {
        driverName: "Low",
        scoring_engine: "frms",
        nowPct: 20,
        peakNext24Pct: 30,
        cells: [],
      },
      {
        driverName: "High",
        scoring_engine: "frms",
        nowPct: 50,
        peakNext24Pct: 55,
        cells: [],
      },
    ]);
    expect(actionable).toHaveLength(1);
    expect(actionable[0].driverName).toBe("High");
    expect(belowThreshold).toHaveLength(1);
    expect(summary.actionable_count).toBe(1);
    expect(summary.below_threshold_count).toBe(1);
  });
});

describe("buildFleetPriorityQueue", () => {
  it("sorts by nowPct and assigns reasons", () => {
    const queue = buildFleetPriorityQueue([
      {
        driverName: "A",
        scoring_engine: "frms",
        nowPct: 40,
        peakNext24Pct: 30,
        cells: [],
      },
      {
        driverName: "B",
        scoring_engine: "frms",
        nowPct: 72,
        peakNext24Pct: 80,
        cells: [],
      },
    ]);
    expect(queue[0].driverName).toBe("B");
    expect(queue[0].severity).toBe("critical");
    expect(queue).toHaveLength(1);
    expect(queue[0].driverName).toBe("B");
  });
});

describe("fleetWorstNowDriver", () => {
  it("returns top now driver", () => {
    expect(
      fleetWorstNowDriver([
        {
          driverName: "X",
          scoring_engine: "frms",
          nowPct: 55,
          peakNext24Pct: 60,
          cells: [],
        },
      ])
    ).toEqual({ driverName: "X", nowPct: 55 });
  });
});

describe("pickHighestCurrentRiskDriver", () => {
  it("picks driver with highest nowPct", () => {
    expect(
      pickHighestCurrentRiskDriver([
        { driverName: "A", nowPct: 40 },
        { driverName: "B", nowPct: 72 },
        { driverName: "C", nowPct: 55 },
      ])
    ).toBe("B");
  });

  it("returns null for empty list", () => {
    expect(pickHighestCurrentRiskDriver([])).toBeNull();
  });
});

describe("findFleetNowIndex", () => {
  const cells: FleetRiskCell[] = [
    { blockStartMs: 100, label: "a", pct: 10 },
    { blockStartMs: 200, label: "b", pct: 20, isNow: true },
    { blockStartMs: 300, label: "c", pct: 30 },
  ];

  it("finds now block by ms", () => {
    expect(findFleetNowIndex(cells, 200)).toBe(1);
  });

  it("returns -1 when missing", () => {
    expect(findFleetNowIndex(cells, 999)).toBe(-1);
  });
});
