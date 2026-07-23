/**
 * RULE IP — Do not change fatigue time/compliance rule logic without explicit owner approval.
 * See .cursor/rules/time-rules-ip.mdc
 *
 * Pluggable compliance engine entry (ADR 0001).
 * WA implementation delegates to runComplianceChecks in ../compliance.ts (same behaviour).
 *
 * App/API entry points use getComplianceEngine() (see S8); tests may still call runComplianceChecks.
 */
import type { ComplianceDayData, ComplianceCheckResult } from "@/lib/compliance";
import { runComplianceChecks } from "@/lib/compliance";
import { runWaComplianceChecks } from "@/lib/ami/compliance-bridge";
import type { JurisdictionCode } from "./types";
import { DEFAULT_JURISDICTION_CODE } from "./types";
import { nhvrProvisionalEngine } from "./nhvr-provisional-engine";

/** Options accepted by the WA engine (matches runComplianceChecks). */
export type ComplianceEngineRunOptions = Parameters<typeof runComplianceChecks>[1];

export type ComplianceEngine = {
  readonly jurisdiction: JurisdictionCode;
  run(days: ComplianceDayData[], options: ComplianceEngineRunOptions): ComplianceCheckResult[];
};

/**
 * WA engine via getComplianceEngine().
 * Phase 3: optional AMI overlay when AMI_COMPLIANCE_ENGINE_ENABLED=true (default off).
 * Direct runComplianceChecks() calls (tests, NHVR inner) stay legacy-only.
 */
export const waOsh3132Engine: ComplianceEngine = {
  jurisdiction: DEFAULT_JURISDICTION_CODE,
  run: (days, options) => runWaComplianceChecks(days, options),
};

/**
 * Resolve the compliance engine for a jurisdiction.
 * Extend with NHVR or other packs when implemented (see approval-gates).
 */
export function getComplianceEngine(jurisdiction: JurisdictionCode): ComplianceEngine {
  if (jurisdiction === DEFAULT_JURISDICTION_CODE) {
    return waOsh3132Engine;
  }
  if (jurisdiction === "NHVR_PROVISIONAL") {
    return nhvrProvisionalEngine;
  }
  throw new Error(`No compliance engine registered for jurisdiction: ${jurisdiction}`);
}
