import { describe, expect, it } from "vitest";
import {
  FAULT_REPORT_SEVERITY_LABEL,
  FAULT_REPORT_SEVERITY_TO_MOBILITY,
  formatPerthDateTimeLocal,
  perthDateTimeLocalNow,
} from "./fault-report";

describe("fault report helpers", () => {
  it("maps WAHVA severity onto defect mobility", () => {
    expect(FAULT_REPORT_SEVERITY_TO_MOBILITY.operational).toBe("can_drive");
    expect(FAULT_REPORT_SEVERITY_TO_MOBILITY.restricted).toBe("need_advice");
    expect(FAULT_REPORT_SEVERITY_TO_MOBILITY.inoperable).toBe("cannot_move");
  });

  it("uses the short fault-level words", () => {
    expect(FAULT_REPORT_SEVERITY_LABEL).toEqual({
      operational: "Ok to drive",
      restricted: "Drive with restriction",
      inoperable: "Out of service",
    });
  });

  it("formats a Perth datetime-local for the sheet", () => {
    expect(formatPerthDateTimeLocal("2026-09-20T11:49")).toBe("20/09/2026 11:49 AWST");
  });

  it("returns a datetime-local string for now", () => {
    expect(perthDateTimeLocalNow(new Date("2026-09-20T03:49:00.000Z"))).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
    );
  });
});
