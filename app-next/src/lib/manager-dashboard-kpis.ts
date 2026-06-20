import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import type { DriverRegisterRow } from "@/lib/manager-risk-scoring";

export type DomainKpiTone = "clear" | "monitor" | "warn" | "bad";

export type DomainKpiBadge = {
  label: string;
  tone: DomainKpiTone;
};

export type ManagerDomainKpis = {
  riskAnalysis: DomainKpiBadge;
  complianceRecords: DomainKpiBadge;
  recordEdits: DomainKpiBadge;
};

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? `1 ${singular}` : `${count} ${pluralForm}`;
}

function filterRegisterByDriver(
  rows: DriverRegisterRow[],
  driverFilter?: string
): DriverRegisterRow[] {
  if (!driverFilter) return rows;
  return rows.filter((r) => r.driver === driverFilter);
}

/** Live status chips for the three manager domain overview cards. */
export function buildManagerDomainKpis(input: {
  driverRegister: DriverRegisterRow[];
  breachCount: number;
  unsignedSheetCount: number;
  driverFilter?: string;
}): ManagerDomainKpis {
  const rows = filterRegisterByDriver(input.driverRegister, input.driverFilter);
  const attentionCount = rows.filter((r) => r.tier === "attention").length;
  const elevatedCount = rows.filter((r) => r.tier === "elevated").length;
  const flaggedCount = attentionCount + elevatedCount;

  let riskAnalysis: DomainKpiBadge;
  if (flaggedCount === 0) {
    riskAnalysis = { label: MANAGER_EXPERIENCE.DOMAIN_KPI_ALL_CLEAR, tone: "clear" };
  } else if (attentionCount > 0) {
    riskAnalysis = {
      label: plural(flaggedCount, "needs attention", "need attention"),
      tone: "bad",
    };
  } else {
    riskAnalysis = {
      label: plural(elevatedCount, "elevated"),
      tone: "warn",
    };
  }

  const complianceRecords: DomainKpiBadge =
    input.breachCount === 0
      ? { label: MANAGER_EXPERIENCE.DOMAIN_KPI_ALL_CLEAR, tone: "clear" }
      : {
          label: plural(input.breachCount, "breach", "breaches"),
          tone: "bad",
        };

  const recordEdits: DomainKpiBadge =
    input.unsignedSheetCount === 0
      ? { label: MANAGER_EXPERIENCE.DOMAIN_KPI_ALL_CLEAR, tone: "clear" }
      : {
          label: plural(input.unsignedSheetCount, "unsigned"),
          tone: "monitor",
        };

  return { riskAnalysis, complianceRecords, recordEdits };
}

export function countUnsignedSheetsForWeek(
  sheets: { week_starting?: string | null; signature?: string | null; driver_name?: string | null }[],
  weekStarting: string,
  driverFilter?: string
): number {
  if (!weekStarting) return 0;
  const driverKey = driverFilter?.trim().toLowerCase();
  return sheets.filter((s) => {
    if (s.week_starting !== weekStarting) return false;
    if (s.signature) return false;
    if (driverKey) {
      const name = (s.driver_name ?? "").trim().toLowerCase();
      if (name !== driverKey) return false;
    }
    return true;
  }).length;
}
