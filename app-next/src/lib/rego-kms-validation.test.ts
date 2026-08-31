import { describe, it, expect } from "vitest";
import {
  chainRegoKmsAcrossSheet,
  dayRequiresKmEntry,
  getMinAllowedStartKms,
  formatOdometerGuideLine,
  getOdometerGuideForDay,
  getSheetKmIssues,
  validateSheetKms,
} from "./rego-kms-validation";

describe("dayRequiresKmEntry", () => {
  it("is false for rego-only empty days", () => {
    expect(dayRequiresKmEntry({ truck_rego: "1ABC 234" })).toBe(false);
  });

  it("is true when work was logged", () => {
    expect(
      dayRequiresKmEntry({
        truck_rego: "1ABC 234",
        events: [{ time: "2026-06-01T08:00:00", type: "work" }],
      })
    ).toBe(true);
  });
});

describe("chainRegoKmsAcrossSheet", () => {
  it("links start km to previous day end km for the same rego", () => {
    const days = [
      { truck_rego: "1ABC", start_kms: 1000, end_kms: 1100, events: [{ type: "work" }] },
      { truck_rego: "1ABC", start_kms: 500, end_kms: 1200, events: [{ type: "work" }] },
    ];
    const { days: fixed, startKmsFixes } = chainRegoKmsAcrossSheet(days);
    expect(startKmsFixes).toHaveLength(1);
    expect(startKmsFixes[0]!.dayIndex).toBe(1);
    expect(fixed[1]!.start_kms).toBe(1100);
  });

  it("applies fleet server floor on first driving day", () => {
    const days = [{ truck_rego: "1ABC", start_kms: 1000, end_kms: 1050, events: [{ type: "work" }] }];
    const { days: fixed, startKmsFixes } = chainRegoKmsAcrossSheet(days, { "1abc": 2000 });
    expect(startKmsFixes[0]!.to).toBe(2000);
    expect(fixed[0]!.start_kms).toBe(2000);
  });

  it("chains later days from previous end km, not fleet floor again", () => {
    const days = [
      { truck_rego: "1ABC", start_kms: 3000, end_kms: 2100, events: [{ type: "work" }] },
      { truck_rego: "1ABC", start_kms: 2050, end_kms: 2200, events: [{ type: "work" }] },
    ];
    const { days: fixed, startKmsFixes } = chainRegoKmsAcrossSheet(days, { "1abc": 3000 });
    expect(startKmsFixes).toHaveLength(1);
    expect(startKmsFixes[0]!.dayIndex).toBe(1);
    expect(fixed[1]!.start_kms).toBe(2100);
  });
});

describe("getMinAllowedStartKms", () => {
  it("uses previous day end in week, not fleet max, when chaining", () => {
    const days = [
      { truck_rego: "1ABC", start_kms: 2000, end_kms: 2100, events: [{ type: "work" }] },
      { truck_rego: "1ABC", start_kms: 2050, end_kms: 2200, events: [{ type: "work" }] },
    ];
    expect(getMinAllowedStartKms(days, 1, "1ABC", 3000)).toBe(2100);
  });
});

describe("validateSheetKms", () => {
  it("ignores empty rego-only days", () => {
    const days = [
      { truck_rego: "1ABC", start_kms: undefined, end_kms: undefined },
      {
        truck_rego: "1ABC",
        start_kms: 1000,
        end_kms: 1100,
        events: [{ type: "work" }],
      },
    ];
    expect(validateSheetKms(days)).toBeNull();
  });

  it("names prior day when start km is below previous end in week", () => {
    const days = [
      { truck_rego: "1ABC", start_kms: 1000, end_kms: 1100, events: [{ type: "work" }] },
      { truck_rego: "1ABC", start_kms: 1200, end_kms: 1326500, events: [{ type: "work" }] },
      { truck_rego: "1ABC", start_kms: 1325100, end_kms: 1327000, events: [{ type: "work" }] },
    ];
    const err = validateSheetKms(days);
    expect(err).toMatch(/Tuesday/);
    expect(err).toMatch(/Monday end km was 1326500/);
  });

  it("fails when start km is below server record", () => {
    const days = [
      {
        truck_rego: "1ABC",
        start_kms: 1000,
        end_kms: 1100,
        events: [{ type: "work" }],
      },
    ];
    expect(validateSheetKms(days, { serverMaxByRego: { "1abc": 2000 } })).toMatch(/cannot be lower/);
  });
});

describe("getSheetKmIssues", () => {
  it("flags missing end km separately from start fixes", () => {
    const issues = getSheetKmIssues([
      {
        truck_rego: "1ABC",
        start_kms: 1000,
        end_kms: null,
        events: [{ type: "work" }],
      },
    ]);
    expect(issues.some((i) => i.code === "missing_end")).toBe(true);
  });

  it("does not require a second start km on the next label of the same shift", () => {
    const days = [
      {
        truck_rego: "1HSX204",
        start_kms: 700681,
        end_kms: 701482,
        events: [
          { time: "2026-08-28T11:41:00.000Z", type: "other_work" },
          { time: "2026-08-28T13:06:00.000Z", type: "work" },
        ],
      },
      {
        truck_rego: "1HSX204",
        events: [
          { time: "2026-08-28T18:00:00.000Z", type: "break" },
          { time: "2026-08-28T18:20:00.000Z", type: "work" },
          { time: "2026-08-28T22:35:00.000Z", type: "stop" },
        ],
      },
    ];
    expect(dayRequiresKmEntry(days[1]!, days, 1)).toBe(false);
    expect(getSheetKmIssues(days).filter((i) => i.dayIndex === 1)).toHaveLength(0);
    expect(validateSheetKms(days)).toBeNull();
  });

  it("skips start/end on overnight finish-only card when prior day holds end km", () => {
    const issues = getSheetKmIssues([
      {
        truck_rego: "1ABC",
        start_kms: 1000,
        end_kms: 754481,
        events: [{ time: "2026-07-20T08:00:00", type: "work" }],
      },
      {
        truck_rego: "1ABC",
        events: [{ time: "2026-07-21T02:38:00", type: "stop" }],
      },
    ]);
    expect(issues.filter((i) => i.dayIndex === 1)).toHaveLength(0);
  });

  it("still requires end km after overnight stop once a new shift is worked", () => {
    const issues = getSheetKmIssues([
      {
        truck_rego: "1ABC",
        start_kms: 1000,
        end_kms: 754481,
        events: [{ time: "2026-07-20T08:00:00", type: "work" }],
      },
      {
        truck_rego: "1ABC",
        start_kms: 754481,
        end_kms: null,
        events: [
          { time: "2026-07-21T02:38:00", type: "stop" },
          { time: "2026-07-21T10:00:00", type: "work" },
        ],
      },
    ]);
    expect(issues.some((i) => i.dayIndex === 1 && i.code === "missing_end")).toBe(true);
  });

  it("reports one start issue per day (no duplicate with validateDayKms)", () => {
    const issues = getSheetKmIssues(
      [
        { truck_rego: "1ABC", start_kms: 1325600, end_kms: 1326000, events: [{ type: "work" }] },
        { truck_rego: "1ABC", start_kms: 1325500, end_kms: 1327000, events: [{ type: "work" }] },
      ],
      { serverMaxByRego: { "1abc": 1325600 } }
    );
    expect(issues.filter((i) => i.dayIndex === 0)).toHaveLength(0);
    const monday = issues.filter((i) => i.dayIndex === 1);
    expect(monday).toHaveLength(1);
    expect(monday[0]!.code).toBe("start_too_low");
    expect(monday[0]!.message).toContain("previous day end km");
  });
});

describe("getOdometerGuideForDay", () => {
  it("surfaces prior day end and fleet record separately", () => {
    const days = [
      { truck_rego: "1ABC", start_kms: 1000, end_kms: 1100, events: [{ type: "work" }] },
      { truck_rego: "1ABC", events: [{ type: "work" }] },
    ];
    const guide = getOdometerGuideForDay(days, 1, "1ABC", 5000);
    expect(guide?.priorEndKms).toBe(1100);
    expect(guide?.priorDayLabel).toBe("Sunday");
    expect(guide?.fleetEndKms).toBeNull();
    expect(guide?.minAllowed).toBe(1100);
  });

  it("uses fleet record when no prior day this week", () => {
    const days = [{ truck_rego: "1ABC", events: [{ type: "work" }] }];
    const guide = getOdometerGuideForDay(days, 0, "1ABC", 1325100);
    expect(guide?.fleetEndKms).toBe(1325100);
    expect(guide?.priorEndKms).toBeNull();
  });

  it("formatOdometerGuideLine is one short sentence", () => {
    const guide = getOdometerGuideForDay(
      [{ truck_rego: "1ABC", start_kms: 1, end_kms: 1100, events: [{ type: "work" }] }, { truck_rego: "1ABC", events: [{ type: "work" }] }],
      1,
      "1ABC",
      null
    );
    expect(formatOdometerGuideLine(guide)).toBe("Previous end 1,100 (Sunday)");
  });
});
