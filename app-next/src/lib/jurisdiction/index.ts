/**
 * Jurisdiction scaffolding for Australia-wide / multi-regime fatigue (ADR 0001).
 *
 * All compliance calculations for the live app still run through
 * `src/lib/compliance.ts` (WA OSH Reg 3.132) until explicitly migrated.
 */
export type { JurisdictionCode } from "./types";
export { DEFAULT_JURISDICTION_CODE } from "./types";
export type { ComplianceEngine, ComplianceEngineRunOptions } from "./compliance-engine";
export { waOsh3132Engine, getComplianceEngine } from "./compliance-engine";
export { parseJurisdictionCode } from "./parse";
export { JURISDICTION_OPTIONS, getJurisdictionOptions } from "./options";
export { isNhvrProvisionalEnabled } from "./flags";
