import { describe, expect, it } from "vitest";
import type { ManagerComplianceItem } from "@/lib/api";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import {
  buildDriverRegister,
  chipLabelFromComplianceMessage,
  fatigueExposureWarnings,
  indexNearTermByDriver,
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
      new Map()
    );
    expect(rows[0]!.tier).toBe("monitor");
    expect(rows[0]!.chipLabel).toBe(MANAGER_EXPERIENCE.REGISTER_CHIP.UNSIGNED);
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
      new Map()
    );
    expect(rows[0]!.tier).toBe("elevated");
    expect(rows[0]!.chipLabel).toBe(MANAGER_EXPERIENCE.REGISTER_CHIP.BREAK_RULE);
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

describe("register alert chips", () => {
  it("names a live break-overdue signal instead of Needs attention", () => {
    const rows = buildDriverRegister(
      [item({ results: [] })],
      "2026-06-01",
      [{ id: "s1", driver_name: "Rod Shehan", week_starting: "2026-06-01", signature: "x" } as never],
      new Map([
        [
          "Rod Shehan",
          { kind: "break_overdue", detail: "Break overdue (was due by 09:40)" },
        ],
      ])
    );
    expect(rows[0]!.tier).toBe("attention");
    expect(rows[0]!.chipLabel).toBe(MANAGER_EXPERIENCE.REGISTER_CHIP.BREAK_OVERDUE);
    expect(rows[0]!.topSignal).toBe("Break overdue (was due by 09:40)");
  });

  it("names an open rest window instead of Needs attention", () => {
    expect(
      buildDriverRegister(
        [item({ results: [] })],
        "2026-06-01",
        [{ id: "s1", driver_name: "Rod Shehan", week_starting: "2026-06-01", signature: "x" } as never],
        new Map([
          [
            "Rod Shehan",
            { kind: "insufficient_nonwork", detail: "Recovery in progress: 4.2h since End shift" },
          ],
        ])
      )[0]
    ).toMatchObject({
      chipLabel: MANAGER_EXPERIENCE.REGISTER_CHIP.RECOVERY_WINDOW,
      topSignal: "Recovery in progress: 4.2h since End shift",
    });
  });

  it("names a 168h breach on the chip", () => {
    const rows = buildDriverRegister(
      [
        item({
          results: [
            {
              type: "violation",
              iconKey: "Clock",
              day: "7-day",
              message: "Work exceeds 168 hours in a rolling 14-day window",
            },
          ],
        }),
      ],
      "2026-06-01",
      [{ id: "s1", driver_name: "Rod Shehan", week_starting: "2026-06-01", signature: "x" } as never],
      new Map()
    );
    expect(rows[0]!.tier).toBe("attention");
    expect(rows[0]!.chipLabel).toBe(MANAGER_EXPERIENCE.REGISTER_CHIP.LIMIT_168H);
    expect(rows[0]!.topSignal).toContain("168");
  });

  it("picks break overdue over a long open shift for the same driver", () => {
    const indexed = indexNearTermByDriver([
      { driver: "Jaydin", kind: "no_stop_long", detail: "No End shift logged for 12h+" },
      { driver: "Jaydin", kind: "break_overdue", detail: "Break overdue (was due by 10:15)" },
    ]);
    expect(indexed.get("Jaydin")).toEqual({
      kind: "break_overdue",
      detail: "Break overdue (was due by 10:15)",
    });
  });

  it("maps common engine messages to short chips", () => {
    expect(chipLabelFromComplianceMessage("17h between rest blocks at risk")).toBe(
      MANAGER_EXPERIENCE.REGISTER_CHIP.EPISODE_17H
    );
    expect(chipLabelFromComplianceMessage("rolling 72h non-work short")).toBe(
      MANAGER_EXPERIENCE.REGISTER_CHIP.WINDOW_72H
    );
    expect(chipLabelFromComplianceMessage("Approaching 168h — 8h left")).toBe(
      MANAGER_EXPERIENCE.REGISTER_CHIP.APPROACHING_168H
    );
  });
});
