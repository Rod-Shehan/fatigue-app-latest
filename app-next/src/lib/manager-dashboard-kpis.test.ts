import { describe, expect, it } from "vitest";
import {
  buildManagerDomainKpis,
  countUnsignedSheetsForWeek,
} from "@/lib/manager-dashboard-kpis";
import type { DriverRegisterRow } from "@/lib/manager-risk-scoring";

function row(tier: DriverRegisterRow["tier"], driver = "Alex"): DriverRegisterRow {
  return {
    sheetId: `sheet-${driver}`,
    driver,
    tier,
    chipLabel: "Needs attention",
    topSignal: "—",
    badges: [],
  };
}

describe("buildManagerDomainKpis", () => {
  it("shows all clear when no elevated signals", () => {
    const kpis = buildManagerDomainKpis({
      driverRegister: [row("clear"), row("monitor", "Bob")],
      breachCount: 0,
      unsignedSheetCount: 0,
    });
    expect(kpis.riskAnalysis.label).toBe("All clear");
    expect(kpis.complianceRecords.label).toBe("All clear");
    expect(kpis.recordEdits.label).toBe("All clear");
  });

  it("counts attention and elevated drivers for risk card", () => {
    const kpis = buildManagerDomainKpis({
      driverRegister: [row("attention"), row("elevated", "Bob")],
      breachCount: 0,
      unsignedSheetCount: 0,
    });
    expect(kpis.riskAnalysis.label).toBe("2 need attention");
    expect(kpis.riskAnalysis.tone).toBe("bad");
  });

  it("uses elevated label when only elevated tier present", () => {
    const kpis = buildManagerDomainKpis({
      driverRegister: [row("elevated")],
      breachCount: 0,
      unsignedSheetCount: 0,
    });
    expect(kpis.riskAnalysis.label).toBe("1 elevated");
    expect(kpis.riskAnalysis.tone).toBe("warn");
  });

  it("formats breach and unsigned counts", () => {
    const kpis = buildManagerDomainKpis({
      driverRegister: [],
      breachCount: 3,
      unsignedSheetCount: 1,
    });
    expect(kpis.complianceRecords.label).toBe("3 breaches");
    expect(kpis.recordEdits.label).toBe("1 unsigned");
  });

  it("respects driver filter on register rows", () => {
    const kpis = buildManagerDomainKpis({
      driverRegister: [row("attention", "Alex"), row("elevated", "Bob")],
      breachCount: 0,
      unsignedSheetCount: 0,
      driverFilter: "Bob",
    });
    expect(kpis.riskAnalysis.label).toBe("1 elevated");
  });
});

describe("countUnsignedSheetsForWeek", () => {
  it("counts unsigned sheets for the active week", () => {
    const count = countUnsignedSheetsForWeek(
      [
        { week_starting: "2026-06-15", signature: null, driver_name: "Alex" },
        { week_starting: "2026-06-15", signature: "sig", driver_name: "Bob" },
        { week_starting: "2026-06-08", signature: null, driver_name: "Alex" },
      ],
      "2026-06-15"
    );
    expect(count).toBe(1);
  });

  it("filters by driver name when scoped", () => {
    const count = countUnsignedSheetsForWeek(
      [
        { week_starting: "2026-06-15", signature: null, driver_name: "Alex" },
        { week_starting: "2026-06-15", signature: null, driver_name: "Bob" },
      ],
      "2026-06-15",
      "Bob"
    );
    expect(count).toBe(1);
  });
});
