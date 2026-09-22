import { describe, it, expect } from "vitest";
import {
  checklistMatrixFromDays,
  FORMS_CHECKLIST_KEYS,
  isTripChecklistTicked,
  TRIP_CHECKLIST_KEYS,
} from "./trip-checklist";

describe("trip checklist", () => {
  it("lists week-PDF rows including trailer, forklift, and hook-up", () => {
    expect([...TRIP_CHECKLIST_KEYS]).toEqual([
      "fitness_for_work",
      "daily_vehicle_checklist",
      "dimension_load_checklist",
      "trailer_prestart_checklist",
      "forklift_prestart_checklist",
      "hookup_checklist",
    ]);
    expect([...FORMS_CHECKLIST_KEYS]).toEqual([...TRIP_CHECKLIST_KEYS]);
  });
  it("reads only explicit true as ticked", () => {
    expect(isTripChecklistTicked({ fitness_for_work: true }, "fitness_for_work")).toBe(true);
    expect(isTripChecklistTicked({ fitness_for_work: false }, "fitness_for_work")).toBe(false);
    expect(isTripChecklistTicked({}, "fitness_for_work")).toBe(false);
  });

  it("builds a 6×7 matrix from days", () => {
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
    expect(m).toHaveLength(6);
    expect(m[0]).toEqual([false, false, false, true, false, false, false]);
    expect(m[1][3]).toBe(false);
    expect(m[2][3]).toBe(true);
    expect(m[3][3]).toBe(false);
    expect(m[4][3]).toBe(false);
    expect(m[5][3]).toBe(false);
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

  it("prints trailer, forklift, and hook-up on the week PDF when those forms are ticked", () => {
    const days = Array.from({ length: 7 }, () => ({}));
    days[0] = {
      trailer_prestart_checklist: true,
      forklift_prestart_checklist: true,
      hookup_checklist: true,
    };
    const m = checklistMatrixFromDays(days);
    expect(m).toHaveLength(6);
    expect(m[3][0]).toBe(true);
    expect(m[4][0]).toBe(true);
    expect(m[5][0]).toBe(true);
    expect(isTripChecklistTicked(days[0], "trailer_prestart_checklist")).toBe(true);
    expect(isTripChecklistTicked(days[0], "forklift_prestart_checklist")).toBe(true);
    expect(isTripChecklistTicked(days[0], "hookup_checklist")).toBe(true);
  });
});
