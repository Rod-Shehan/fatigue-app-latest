import { describe, it, expect } from "vitest";
import {
  collectWeekTruckRegs,
  formatWeekWorkHoursTotal,
  renderWeeklyTripSheetFooterHtml,
  renderWeeklyTripSheetHeaderHtml,
  weekEndingDateLabel,
  ymdToAuDisplay,
  formatDriverNameWithLicence,
  WTS_CHECKLIST_ROWS,
  WTS_DAY_ABBREVS,
} from "./weekly-trip-sheet";

describe("weekly trip sheet chrome", () => {
  it("formats week ending as Saturday from Sunday week start", () => {
    expect(weekEndingDateLabel("2026-07-26")).toBe("01/08/2026");
  });

  it("formats roster dates and name+licence for the title block", () => {
    expect(ymdToAuDisplay("2026-03-01")).toBe("01/03/2026");
    expect(ymdToAuDisplay(null)).toBe("—");
    expect(formatDriverNameWithLicence("Alex Driver", "1LIC99")).toBe("Alex Driver  1LIC99");
    expect(formatDriverNameWithLicence("Alex Driver", "")).toBe("Alex Driver");
  });

  it("collects unique truck regs in first-seen order", () => {
    expect(
      collectWeekTruckRegs([
        { truck_rego: "1ABC123" },
        { truck_rego: " " },
        { truck_rego: "1abc123" },
        { truck_rego: "2XYZ999" },
      ])
    ).toEqual(["1ABC123", "2XYZ999"]);
  });

  it("formats week work hours from minutes", () => {
    expect(formatWeekWorkHoursTotal(90)).toBe("1.5");
    expect(formatWeekWorkHoursTotal(0)).toBe("0");
  });

  it("renders header with empty checklist boxes and week meta", () => {
    const html = renderWeeklyTripSheetHeaderHtml({
      weekStarting: "2026-07-26",
      driverName: "Alex Driver",
      truckRegs: ["1ABC123"],
      weekWorkMinutes: 0,
      licenceNumber: "1LIC99",
      medicalExpiryYmd: "2026-03-01",
      licenceExpiryYmd: "2027-06-15",
    });
    expect(html).toContain("WEEKLY TRIP SHEET");
    expect(html).toContain("01/08/2026");
    expect(html).toContain("Alex Driver  1LIC99");
    expect(html).toContain("Driver name:");
    expect(html).toContain("Driver medical expiry:");
    expect(html).toContain("01/03/2026");
    expect(html).toContain("Driver license expiry:");
    expect(html).toContain("15/06/2027");
    expect(html).toContain("1ABC123");
    for (const row of WTS_CHECKLIST_ROWS) {
      expect(html).toContain(row.replace(/&/g, "&amp;"));
    }
    for (const d of WTS_DAY_ABBREVS) expect(html).toContain(d);
    expect(html).toContain("wtsTickBox");
    expect(html).not.toContain("wtsTickBox on");
  });

  it("renders ticks only for days that are set", () => {
    const ticks = [
      [true, false, false, false, false, false, false],
      [false, false, false, false, false, false, false],
      [false, false, false, false, false, false, true],
    ];
    const html = renderWeeklyTripSheetHeaderHtml({
      weekStarting: "2026-07-26",
      driverName: "Alex Driver",
      truckRegs: [],
      weekWorkMinutes: 0,
      checklistTicks: ticks,
    });
    expect(html).toContain("wtsTickBox on");
    expect(html.match(/wtsTickBox on/g)?.length).toBe(2);
  });

  it("renders footer with hours, office use, and signature image when present", () => {
    const html = renderWeeklyTripSheetFooterHtml({
      weekStarting: "2026-07-26",
      driverName: "Alex Driver",
      truckRegs: [],
      weekWorkMinutes: 360,
      signature: "data:image/png;base64,abc",
      signedAt: "2026-08-01T10:00:00.000Z",
    });
    expect(html).toContain("OFFICE USE");
    expect(html).toContain("Total Working Hours Per Week");
    expect(html).toContain(">6<");
    expect(html).toContain("DRIVER SIGNATURE");
    expect(html).toContain('src="data:image/png;base64,abc"');
    expect(html).toContain("Signed:");
  });
});
