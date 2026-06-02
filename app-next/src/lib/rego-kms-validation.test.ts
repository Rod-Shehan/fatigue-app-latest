import { describe, it, expect } from "vitest";
import {
  chainRegoKmsAcrossSheet,
  dayRequiresKmEntry,
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
});
