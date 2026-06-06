import { describe, expect, it } from "vitest";
import {
  fleetHeatmapLabelIndices,
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
