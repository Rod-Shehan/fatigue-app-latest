import { describe, expect, it } from "vitest";
import {
  buildFleetPriorityQueue,
  fleetHeatmapLabelIndices,
  fleetWorstNowDriver,
  findFleetNowIndex,
  pickHighestCurrentRiskDriver,
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

describe("buildFleetPriorityQueue", () => {
  it("sorts by nowPct and assigns reasons", () => {
    const queue = buildFleetPriorityQueue([
      {
        driverName: "A",
        scoring_engine: "frms",
        nowPct: 40,
        peakNext24Pct: 50,
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
    expect(queue[1].reason).toContain("24h");
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
