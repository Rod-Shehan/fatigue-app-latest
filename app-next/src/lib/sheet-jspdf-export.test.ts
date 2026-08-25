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
  it("legacy full layout still has compliance summary and shift log", () => {
    const html = renderPdfHtml({
      sheet,
      todayStr: "2026-08-19",
      generatedAtLabel: "19/08/2026, 7:30:48 pm",
      roadside,
      layout: "full",
    });
    expect(html).toContain("Roadside compliance summary");
    expect(html).toContain("SHIFT LOG (Appendix)");
    expect(html).toContain("WEEKLY TRIP SHEET");
    expect(html).toContain("CIRCADIA24");
  });

  it("trip-sheet html tolerates a missing day slot", () => {
    const html = renderPdfHtml({
      sheet: {
        ...sheet,
        days: [{}, null, {}] as unknown as typeof sheet.days,
      },
      todayStr: "2026-08-19",
      generatedAtLabel: "19/08/2026, 7:30:48 pm",
      layout: "tripSheetOnly",
    });
    expect(html).toContain("WEEKLY TRIP SHEET");
  });

  it("builds a trip-sheet jsPDF for a completed week with checklists and other_work", async () => {
    const { buildSingleSheetJsPdfBuffer } = await import("@/lib/sheet-jspdf-export");
    const tinyPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const days = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-08-${String(16 + i).padStart(2, "0")}`,
      truck_rego: "1TEST",
      start_location: "Perth",
      destination: "Site",
      start_kms: i < 5 ? 1000 : null,
      end_kms: i < 5 ? 1100 : null,
      events:
        i === 4
          ? [
              { time: "2026-08-20T06:00:00", type: "work" },
              { time: "2026-08-20T10:00:00", type: "other_work" },
              { time: "2026-08-20T12:00:00", type: "stop" },
            ]
          : i < 5
            ? [
                { time: `2026-08-${String(16 + i).padStart(2, "0")}T06:00:00`, type: "work" },
                { time: `2026-08-${String(16 + i).padStart(2, "0")}T12:00:00`, type: "stop" },
              ]
            : i === 5
              ? [{ time: "2026-08-21T00:00:00", type: "stop" }]
              : undefined,
      checklists:
        i < 5
          ? [{ id: `ck-${i}`, type: "ffw", status: "completed", items: [{ code: "a" }] }]
          : undefined,
      fitness_for_work: i < 5,
    }));
    const buf = await buildSingleSheetJsPdfBuffer({
      sheet: {
        ...sheet,
        status: "completed",
        signed_at: "2026-08-22T10:00:00.000Z",
        signature: tinyPng,
        days,
      },
      todayStr: "2026-08-25",
      generatedAtLabel: "25/08/2026, 2:30:00 pm",
      layout: "tripSheetOnly",
    });
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it("week export and roadside trip-sheet-only omit header, compliance, and appendix", () => {
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
