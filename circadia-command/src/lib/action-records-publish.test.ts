import { describe, expect, it } from "vitest";
import {
  ACTION_RECORD_CSV_HEADERS,
  ACTION_RECORD_PACK_LABELS,
  ACTION_RECORD_WINDOW_HOURS,
  ACTION_RECORD_WINDOW_LABELS,
  actionRecordSince,
  actionRecordsDownloadName,
  actionTakenLabel,
  buildActionRecordsCsv,
  buildActionRecordsHtml,
  buildActionRecordsVideoZip,
  formatPerthPublishDateTime,
  outcomeLabel,
  parseActionRecordPack,
  parseActionRecordWindow,
  type ActionRecordPreview,
  type ActionRecordRow,
} from "@/lib/action-records-publish";

const sample: ActionRecordRow = {
  lifecycleId: "life-1",
  eventId: "evt-1",
  eventAtIso: "2026-09-30T02:15:00.000Z",
  eventAtLabel: "30/09/2026, 10:15",
  actionedAtIso: "2026-09-30T02:40:00.000Z",
  actionedAtLabel: "30/09/2026, 10:40",
  driverName: "Satnam",
  vehicleRego: "1ABC123",
  eventType: "microsleep",
  confidence: "0.91",
  speedKmh: "82.00",
  outcome: "Verified fatigue",
  actionTaken: "Driver - contacted by phone, confirmed ok",
  notes: "Pulled into rest area",
  actor: "Command desk",
  videoUrl: "https://example.com/clip.mp4",
};

const preview: ActionRecordPreview = {
  window: "24h",
  windowLabel: "Last 24 hours",
  sinceIso: "2026-09-29T02:00:00.000Z",
  generatedAtIso: "2026-09-30T02:00:00.000Z",
  count: 1,
  truncated: false,
  records: [sample],
};

describe("action-records-publish", () => {
  it("parses windows and packs", () => {
    expect(parseActionRecordWindow("24h")).toBe("24h");
    expect(parseActionRecordWindow("week")).toBe("week");
    expect(parseActionRecordWindow("month")).toBe("month");
    expect(() => parseActionRecordWindow("year")).toThrow(/24 hours/);
    expect(parseActionRecordPack("list")).toBe("list");
    expect(parseActionRecordPack("video")).toBe("video");
    expect(() => parseActionRecordPack("pdf")).toThrow(/video/);
  });

  it("uses rolling 24h / 7d / 30d windows", () => {
    expect(ACTION_RECORD_WINDOW_HOURS["24h"]).toBe(24);
    expect(ACTION_RECORD_WINDOW_HOURS.week).toBe(168);
    expect(ACTION_RECORD_WINDOW_HOURS.month).toBe(720);
    expect(ACTION_RECORD_WINDOW_LABELS.month).toBe("Last month");
    expect(ACTION_RECORD_PACK_LABELS.video).toBe("Video and event metadata");
    const now = new Date("2026-09-30T08:00:00.000Z");
    expect(actionRecordSince("24h", now).toISOString()).toBe("2026-09-29T08:00:00.000Z");
  });

  it("labels outcomes and actions from status plus resolution", () => {
    expect(outcomeLabel("VERIFIED_FALSE_POSITIVE", null)).toBe("False positive");
    expect(outcomeLabel("VERIFIED_TRUE_FATIGUE", "verified_distraction")).toBe(
      "Verified distraction"
    );
    expect(actionTakenLabel("VERIFIED_FALSE_POSITIVE", null)).toBe("Dismissed as false positive");
    expect(actionTakenLabel("VERIFIED_TRUE_FATIGUE", "driver_no_contact")).toBe(
      "Driver - not able to make contact"
    );
  });

  it("builds a CSV list with metadata and the action taken", () => {
    const csv = buildActionRecordsCsv([sample]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain(ACTION_RECORD_CSV_HEADERS.join(","));
    expect(csv).toContain("Satnam");
    expect(csv).toContain("Driver - contacted by phone, confirmed ok");
    expect(csv).toContain("https://example.com/clip.mp4");
  });

  it("escapes commas and quotes in CSV cells", () => {
    const csv = buildActionRecordsCsv([
      { ...sample, notes: 'Rested, then "ok"', actionTaken: "Other - make note of other outcome" },
    ]);
    expect(csv).toContain('"Rested, then ""ok"""');
  });

  it("builds a video pack HTML gallery and zip", () => {
    const html = buildActionRecordsHtml(preview, new Date("2026-09-30T08:00:00.000Z"));
    expect(html).toContain("Last 24 hours");
    expect(html).toContain("Satnam");
    expect(html).toContain("Driver - contacted by phone, confirmed ok");
    expect(html).toContain('src="https://example.com/clip.mp4"');
    const zip = buildActionRecordsVideoZip(preview);
    expect(zip[0]).toBe(0x50);
    expect(zip.byteLength).toBeGreaterThan(200);
  });

  it("names downloads by pack and window", () => {
    expect(actionRecordsDownloadName("list", "week", new Date("2026-09-30T16:00:00.000Z"))).toMatch(
      /^circadia-command-action-records-list-week-\d{4}-\d{2}-\d{2}\.csv$/
    );
    expect(actionRecordsDownloadName("video", "month", new Date("2026-09-30T16:00:00.000Z"))).toMatch(
      /\.zip$/
    );
  });

  it("formats Perth times as dd/mm/yyyy", () => {
    const label = formatPerthPublishDateTime("2026-09-30T02:15:00.000Z");
    expect(label).toMatch(/30\/09\/2026/);
  });
});
