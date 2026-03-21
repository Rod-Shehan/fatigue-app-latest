/**
 * NHVR-oriented **provisional** pack (S5 / ADR 0001).
 * Does not implement certified Heavy Vehicle National Law BFM / EWD logic.
 * Until dedicated NHVR rules exist, behaviour matches WA OSH Reg 3.132 with a clear banner warning.
 *
 * (Do not import `./compliance-engine` here — avoids circular dependency with getComplianceEngine.)
 */
import type { ComplianceDayData, ComplianceCheckResult } from "@/lib/compliance";
import { runComplianceChecks } from "@/lib/compliance";

type RunOpts = Parameters<typeof runComplianceChecks>[1];

const NHVR_PROVISIONAL_BANNER: ComplianceCheckResult = {
  type: "warning",
  iconKey: "AlertTriangle",
  day: "Sheet",
  message:
    "NHVR BFM (provisional): not an approved Electronic Work Diary. Calculations use WA OSH Reg 3.132 until NHVR-specific rules are implemented — verify obligations with NHVR and your policies.",
};

export const nhvrProvisionalEngine = {
  jurisdiction: "NHVR_PROVISIONAL" as const,
  run(days: ComplianceDayData[], options: RunOpts): ComplianceCheckResult[] {
    const wa = runComplianceChecks(days, options);
    return [NHVR_PROVISIONAL_BANNER, ...wa];
  },
};
