import { describe, expect, it } from "vitest";
import type { ManagerComplianceItem } from "@/lib/api";
import {
  buildDriverRegister,
  fatigueExposureWarnings,
  isHousekeepingComplianceWarning,
  tierForComplianceItem,
} from "@/lib/manager-risk-scoring";

function item(partial: Partial<ManagerComplianceItem>): ManagerComplianceItem {
  return {
    sheetId: "s1",
    driver_name: "Rod Shehan",
    week_starting: "2026-06-01",
    results: [],
    totalEvents: 10,
    eventsWithLocation: 3,
    ...partial,
  };
}

describe("manager-risk-scoring tiers", () => {
  it("unsigned + thin GPS only → monitor, not elevated", () => {
    const tier = tierForComplianceItem(item({ results: [] }), {
      unsigned: true,
    });
    expect(tier).toBe("monitor");
  });

  it("location evidence warning alone → monitor", () => {
    const tier = tierForComplianceItem(
      item({
        results: [
          {
            type: "warning",
            ruleId: "location_evidence",
            iconKey: "MapPin",
            day: "7-day",
            message: "Location wasn't recorded for some events",
          },
        ],
      }),
      { unsigned: true }
    );
    expect(tier).toBe("monitor");
  });

  it("shift pattern education alone → monitor", () => {
    const tier = tierForComplianceItem(
      item({
        results: [
          {
            type: "warning",
            ruleId: "shift_change_education",
            iconKey: "Clock",
            day: "Wed",
            message: "Set A/B after 120h+",
          },
        ],
      }),
      { unsigned: false }
    );
    expect(tier).toBe("monitor");
  });

  it("fatigue rule warning (e.g. 5h break) → elevated", () => {
    const tier = tierForComplianceItem(
      item({
        results: [
          {
            type: "warning",
            iconKey: "Coffee",
            day: "Wed",
            message: "20 min rest per 5h work",
          },
        ],
      }),
      { unsigned: true }
    );
    expect(tier).toBe("elevated");
  });

  it("violation → attention", () => {
    const tier = tierForComplianceItem(
      item({
        results: [
          {
            type: "violation",
            iconKey: "Coffee",
            day: "Wed",
            message: "Exceeded work limit",
          },
        ],
      }),
      { unsigned: true }
    );
    expect(tier).toBe("attention");
  });

  it("deriveTopSignal matches monitor tier for unsigned + GPS", () => {
    const rows = buildDriverRegister(
      [item({ results: [] })],
      "2026-06-01",
      [{ id: "s1", driver_name: "Rod Shehan", week_starting: "2026-06-01" } as never],
      new Set()
    );
    expect(rows[0]!.tier).toBe("monitor");
    expect(rows[0]!.topSignal).toBe("Week not yet signed by driver");
  });

  it("elevated tier shows fatigue warning, not unsigned subtitle", () => {
    const rows = buildDriverRegister(
      [
        item({
          results: [
            {
              type: "warning",
              iconKey: "Coffee",
              day: "Wed",
              message: "20 min rest per 5h work on Wednesday",
            },
          ],
        }),
      ],
      "2026-06-01",
      [{ id: "s1", driver_name: "Rod Shehan", week_starting: "2026-06-01", signature: "x" } as never],
      new Set()
    );
    expect(rows[0]!.tier).toBe("elevated");
    expect(rows[0]!.topSignal).toContain("5h work");
  });
});

describe("isHousekeepingComplianceWarning", () => {
  it("classifies education and GPS evidence as housekeeping", () => {
    expect(
      isHousekeepingComplianceWarning({
        type: "warning",
        ruleId: "shift_change_education",
        iconKey: "Clock",
        day: "x",
        message: "m",
      })
    ).toBe(true);
    expect(fatigueExposureWarnings([])).toHaveLength(0);
  });
});
