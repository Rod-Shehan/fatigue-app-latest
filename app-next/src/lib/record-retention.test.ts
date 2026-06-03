import { describe, expect, it } from "vitest";
import {
  COMPLIANCE_PRIOR_WEEKS_LOOKBACK,
} from "@/lib/compliance-history";
import {
  DRIVER_HELP_RETENTION_BULLETS,
  RECORD_RETENTION_WEEKS,
  RECORD_RETENTION_YEARS,
  formatAssuranceLookbackFootnote,
  formatComplianceLookbackFootnote,
  getRecordRetentionPolicy,
} from "@/lib/record-retention";

describe("record-retention policy", () => {
  it("exports aligned retention and lookback constants", () => {
    expect(RECORD_RETENTION_YEARS).toBe(3);
    expect(RECORD_RETENTION_WEEKS).toBe(156);
    expect(getRecordRetentionPolicy()).toEqual({
      retention_years: 3,
      retention_weeks: 156,
      compliance_lookback_weeks: COMPLIANCE_PRIOR_WEEKS_LOOKBACK,
      regulatory_doc: "docs/regulatory/record-retention-and-compliance-lookback.md",
    });
  });

  it("footnotes mention lookback weeks and retention years", () => {
    const driver = formatComplianceLookbackFootnote();
    const manager = formatAssuranceLookbackFootnote();
    expect(driver).toContain(String(COMPLIANCE_PRIOR_WEEKS_LOOKBACK));
    expect(driver).toContain(String(RECORD_RETENTION_YEARS));
    expect(manager).toContain(String(COMPLIANCE_PRIOR_WEEKS_LOOKBACK));
    expect(manager).toContain(String(RECORD_RETENTION_YEARS));
    expect(DRIVER_HELP_RETENTION_BULLETS.length).toBeGreaterThanOrEqual(2);
  });
});
