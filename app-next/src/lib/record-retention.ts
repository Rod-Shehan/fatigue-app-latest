import { COMPLIANCE_PRIOR_WEEKS_LOOKBACK } from "@/lib/compliance-history";

/**
 * Legal minimum record retention — not the same as compliance rule lookback.
 *
 * @see docs/regulatory/record-retention-and-compliance-lookback.md
 * - WA WHS (General) Regs 2022 reg 184G: ≥ 3 years from last entry
 * - HVNL s 341: 3 years after record made/received
 */
export const RECORD_RETENTION_YEARS = 3;

/** Approximate weeks for scheduling (~52 weeks/year). Use calendar logic when dates matter. */
export const RECORD_RETENTION_WEEKS = RECORD_RETENTION_YEARS * 52;

/** In-repo regulatory reference (relative to app-next/). */
export const RECORD_RETENTION_DOC = "docs/regulatory/record-retention-and-compliance-lookback.md";

export type RecordRetentionPolicy = {
  retention_years: number;
  retention_weeks: number;
  compliance_lookback_weeks: number;
  regulatory_doc: string;
};

/** Serializable policy block for API responses and client copy. */
export function getRecordRetentionPolicy(): RecordRetentionPolicy {
  return {
    retention_years: RECORD_RETENTION_YEARS,
    retention_weeks: RECORD_RETENTION_WEEKS,
    compliance_lookback_weeks: COMPLIANCE_PRIOR_WEEKS_LOOKBACK,
    regulatory_doc: RECORD_RETENTION_DOC,
  };
}

/** Driver / sheet compliance surfaces. */
export function formatComplianceLookbackFootnote(): string {
  return (
    `Rolling checks load about ${COMPLIANCE_PRIOR_WEEKS_LOOKBACK} prior weeks of submitted records for 14–28 day rules — ` +
    `that is rule-engine lookback, not a retention limit. Signed records must be kept for at least ${RECORD_RETENTION_YEARS} years (WA Reg 184G; HVNL s 341).`
  );
}

/** Manager assurance / risk brief surfaces. */
export function formatAssuranceLookbackFootnote(): string {
  return (
    `Assurance signals use compliance math on roughly the last ${COMPLIANCE_PRIOR_WEEKS_LOOKBACK} weeks of history per driver. ` +
    `Your organisation must still retain signed records for at least ${RECORD_RETENTION_YEARS} years.`
  );
}

export const DRIVER_HELP_RETENTION_BULLETS = [
  `Your signed weekly records must be kept for at least ${RECORD_RETENTION_YEARS} years — a legal retention requirement under WA Reg 184G and HVNL s 341.`,
  `Circadia loads about ${COMPLIANCE_PRIOR_WEEKS_LOOKBACK} prior weeks when calculating 14–28 day fatigue limits on a sheet. Older weeks remain on file for audits and exports.`,
  "Roadside produce (about 28 days in a work diary) is separate from both retention and in-app rule lookback.",
] as const;
