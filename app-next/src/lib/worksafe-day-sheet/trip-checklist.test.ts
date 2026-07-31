import { describe, it, expect } from "vitest";
import { checklistMatrixFromDays, isTripChecklistTicked } from "./trip-checklist";

describe("trip checklist", () => {
  it("reads only explicit true as ticked", () => {
    expect(isTripChecklistTicked({ fitness_for_work: true }, "fitness_for_work")).toBe(true);
    expect(isTripChecklistTicked({ fitness_for_work: false }, "fitness_for_work")).toBe(false);
    expect(isTripChecklistTicked({}, "fitness_for_work")).toBe(false);
  });

  it("builds a 3×7 matrix from days", () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      i === 3
        ? {
            fitness_for_work: true,
            dimension_load_checklist: true,
            daily_vehicle_checklist: false,
          }
        : {}
    );
    const m = checklistMatrixFromDays(days);
    expect(m).toHaveLength(3);
    expect(m[0]).toEqual([false, false, false, true, false, false, false]);
    expect(m[1][3]).toBe(true);
    expect(m[2][3]).toBe(false);
  });

  it("derives matrix ticks from completed checklist records", () => {
    const days = Array.from({ length: 7 }, () => ({}));
    days[1] = {
      checklists: [
        {
          id: "1",
          type: "ffw",
          schemaVersion: 1,
          status: "completed",
          completedAtUtc: "2026-07-31T00:00:00.000Z",
          items: [],
          signatures: [],
        },
      ],
    };
    const m = checklistMatrixFromDays(days);
    expect(m[0][1]).toBe(true);
    expect(m[1][1]).toBe(false);
    expect(m[2][1]).toBe(false);
  });
});
