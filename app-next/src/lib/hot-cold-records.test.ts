import { describe, expect, it } from "vitest";
import {
  COLD_RETRIEVAL_SLA_BUSINESS_DAYS,
  HOT_WINDOW_ALL_LIVE,
  formatHotWindowSummary,
  getHotColdAccessPolicy,
  isWeekStartingInHotWindow,
} from "@/lib/hot-cold-records";

describe("hot-cold-records", () => {
  it("locks H1 all-live and H2 SLA on the policy object", () => {
    const policy = getHotColdAccessPolicy();
    expect(policy.hot_window_all_live).toBe(true);
    expect(HOT_WINDOW_ALL_LIVE).toBe(true);
    expect(policy.hot_window_months).toBeNull();
    expect(policy.cold_retrieval_sla_business_days).toBe(COLD_RETRIEVAL_SLA_BUSINESS_DAYS);
    expect(policy.cold_retrieval_sla_business_days).toBe(2);
    expect(policy.delivery).toBe("sor_pack_required_pdf_optional");
  });

  it("treats every valid week as hot while H1 all-live is on", () => {
    expect(isWeekStartingInHotWindow("2019-01-06", "2026-08-08")).toBe(true);
    expect(isWeekStartingInHotWindow("2026-08-02", "2026-08-08")).toBe(true);
  });

  it("rejects malformed week ids", () => {
    expect(isWeekStartingInHotWindow("not-a-date", "2026-08-08")).toBe(false);
  });

  it("explains live vs archive without promising infinite date pickers", () => {
    const summary = formatHotWindowSummary();
    expect(summary.toLowerCase()).toContain("immediately");
    expect(summary.toLowerCase()).toContain("request");
  });
});
