/**
 * Hot (live DB) vs cold (long-term storage) electronic record access.
 *
 * Doctrine: electronic SoR = structured data + signature (+ audit), not PDF.
 * @see docs/product/hot-cold-record-access-project-scope.md
 *
 * P2 locked (owner 2026-08-08):
 * - H1: all signed sheets stay hot until multi-fleet scale forces graduation
 * - H2: cold retrieval SLA = 2 business days (AWST)
 * - H3: tenant owner + Circadia ops (named managers if delegated)
 * - H4: SoR pack required; PDF optional reproduction
 * - H5: R2 dumps ≥ 3 years
 */

import { RECORD_RETENTION_YEARS } from "@/lib/record-retention";

/** Locked H1 — do not graduate sheets off Neon until owner revisits at scale. */
export const HOT_WINDOW_ALL_LIVE = true;

/** Locked H2 — standard cold retrieve SLA (business days, AWST). */
export const COLD_RETRIEVAL_SLA_BUSINESS_DAYS = 2;

/** Future graduation length (months) when HOT_WINDOW_ALL_LIVE becomes false. */
export const HOT_WINDOW_MONTHS_WHEN_GRADUATED = 24;

const WEEK_YMD = /^\d{4}-\d{2}-\d{2}$/;

export type HotColdAccessPolicy = {
  hot_window_all_live: boolean;
  hot_window_months: number | null;
  cold_retrieval_sla_business_days: number;
  retention_years: number;
  delivery: "sor_pack_required_pdf_optional";
};

export function getHotColdAccessPolicy(): HotColdAccessPolicy {
  return {
    hot_window_all_live: HOT_WINDOW_ALL_LIVE,
    hot_window_months: HOT_WINDOW_ALL_LIVE ? null : HOT_WINDOW_MONTHS_WHEN_GRADUATED,
    cold_retrieval_sla_business_days: COLD_RETRIEVAL_SLA_BUSINESS_DAYS,
    retention_years: RECORD_RETENTION_YEARS,
    delivery: "sor_pack_required_pdf_optional",
  };
}

/**
 * Whether a regulatory week (Sunday YMD) is still queryable in the live (hot) DB.
 * Under H1 this is always true.
 */
export function isWeekStartingInHotWindow(
  weekStartingYmd: string,
  todayYmd: string = new Date().toISOString().slice(0, 10)
): boolean {
  if (!WEEK_YMD.test(weekStartingYmd) || !WEEK_YMD.test(todayYmd)) return false;
  if (HOT_WINDOW_ALL_LIVE) return true;

  const weekMs = Date.parse(`${weekStartingYmd}T00:00:00.000Z`);
  const todayMs = Date.parse(`${todayYmd}T00:00:00.000Z`);
  if (!Number.isFinite(weekMs) || !Number.isFinite(todayMs)) return false;

  const months = HOT_WINDOW_MONTHS_WHEN_GRADUATED;
  const cutoff = new Date(todayMs);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return weekMs >= cutoff.getTime();
}

/** Plain-language live-window summary for manager UI. */
export function formatHotWindowSummary(): string {
  if (HOT_WINDOW_ALL_LIVE) {
    return "Recent fleet records are available immediately in Circadia. Older retained records stay in long-term storage when graduated — request them here rather than expecting an infinite date picker.";
  }
  return `Live records cover about the last ${HOT_WINDOW_MONTHS_WHEN_GRADUATED} months. Older retained records are in long-term storage — request retrieval (about ${COLD_RETRIEVAL_SLA_BUSINESS_DAYS} business days).`;
}
