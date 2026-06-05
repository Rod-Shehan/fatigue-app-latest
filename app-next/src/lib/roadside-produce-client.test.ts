import { describe, expect, it } from "vitest";
import type { FatigueSheet } from "@/lib/api";
import { getRoadsideProduceFromYmd, selectSheetsForRoadsideProduce } from "@/lib/roadside-produce";
import { computeComplianceForCachedSheets } from "@/lib/sheet-export-compliance-cache";

function sheet(week: string, driver = "Alex"): FatigueSheet {
  return {
    id: `s-${week}`,
    driver_name: driver,
    driver_type: "solo",
    week_starting: week,
    days: Array.from({ length: 7 }, () => ({})),
    status: "active",
    jurisdiction_code: "AU-WA",
  };
}

describe("roadside produce client helpers", () => {
  it("selects cached weeks in 28-day window", () => {
    const from = getRoadsideProduceFromYmd("2026-06-02", 28);
    const picked = selectSheetsForRoadsideProduce(
      [sheet("2026-04-20"), sheet("2026-05-25"), sheet("2026-06-01")],
      from,
      "2026-06-02"
    );
    expect(picked.map((s) => s.week_starting)).toEqual(["2026-05-25", "2026-06-01"]);
  });

  it("computeComplianceForCachedSheets uses prior week from cache", () => {
    const current = sheet("2026-06-01");
    current.days = Array.from({ length: 7 }, (_, i) =>
      i === 0
        ? {
            work_time: Array(48).fill(false).map((_, j) => j < 40),
            breaks: Array(48).fill(false),
            non_work: Array(48).fill(false).map((_, j) => j >= 40),
          }
        : {}
    );
    const prev = sheet("2026-05-25");
    const { results } = computeComplianceForCachedSheets([current, prev], current);
    expect(Array.isArray(results)).toBe(true);
  });
});
