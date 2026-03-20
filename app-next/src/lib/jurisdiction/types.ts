/**
 * Jurisdiction and rule-set identifiers for pluggable compliance (ADR 0001).
 * Extend as new regimes are implemented — do not hard-code UI against strings here.
 */

/** Implemented or planned regulatory scopes (narrow union grows over time). */
export type JurisdictionCode = "WA_OSH_3132";

/** Default regime for the current production build (WA OSH Reg 3.132). */
export const DEFAULT_JURISDICTION_CODE: JurisdictionCode = "WA_OSH_3132";
