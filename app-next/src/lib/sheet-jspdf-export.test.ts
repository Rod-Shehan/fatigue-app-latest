import { describe, expect, it } from "vitest";
import { renderPdfHtml } from "@/lib/sheet-jspdf-export";
import { renderRoadsideProduceDocumentHtml } from "@/lib/roadside-produce-pdf";

const sheet = {
  driver_name: "Jaydin Ireland",
  second_driver: null,
  driver_type: "solo",
  week_starting: "2026-08-16",
  jurisdiction_label: "WA: WHS r184E - OSH r3.132",
  last_24h_break: "2026-08-15",
  status: "active",
  signed_at: null,
  signature: null,
  days: Array.from({ length: 7 }, () => ({})),
};

const roadside = {
  driverName: "Jaydin Ireland",
  weekStarting: "2026-08-16",
  jurisdictionLabel: "WA: WHS r184E - OSH r3.132",
  violations: [{ day: "Week", message: "14-day: Need >=2x24h" }],
  warnings: [],
  disclaimer: "Not legal advice.",
};

describe("sheet PDF layouts", () => {
  it("full week export keeps compliance summary and shift log", () => {
    const html = renderPdfHtml({
      sheet,
      todayStr: "2026-08-19",
      generatedAtLabel: "19/08/2026, 7:30:48 pm",
      roadside,
    });
    expect(html).toContain("Roadside compliance summary");
    expect(html).toContain("SHIFT LOG (Appendix)");
    expect(html).toContain("WEEKLY TRIP SHEET");
    expect(html).toContain("CIRCADIA24");
  });

  it("roadside trip-sheet-only layout omits header, compliance, and appendix", () => {
    const html = renderPdfHtml({
      sheet,
      todayStr: "2026-08-19",
      generatedAtLabel: "19/08/2026, 7:30:48 pm",
      roadside,
      layout: "tripSheetOnly",
    });
    expect(html).toContain("WEEKLY TRIP SHEET");
    expect(html).not.toContain("Roadside compliance summary");
    expect(html).not.toContain("Plausibility");
    expect(html).not.toContain("SHIFT LOG (Appendix)");
    expect(html).not.toContain("CIRCADIA24");
    expect(html).toContain("page-break-before: auto");
  });
});

describe("roadside produce document", () => {
  it("wraps weeks with one-page-per-week CSS and no cover", () => {
    const html = renderRoadsideProduceDocumentHtml({
      driverName: "Jaydin Ireland",
      fromYmd: "2026-07-22",
      toYmd: "2026-08-19",
      generatedAtLabel: "19/08/2026, 7:30:48 pm",
      todayStr: "2026-08-19",
      weekBodies: ["<div class=\"wtsWeekBody\">week-a</div>", "<div class=\"wtsWeekBody\">week-b</div>"],
    });
    expect(html).toContain("week-a");
    expect(html).toContain("week-b");
    expect(html).toContain("page-break-before: always");
    expect(html).not.toContain("Roadside produce — driver record");
    expect(html).not.toContain("CIRCADIA24");
  });
});
