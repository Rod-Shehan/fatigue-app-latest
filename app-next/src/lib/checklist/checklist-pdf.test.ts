import { describe, it, expect } from "vitest";
import { collectChecklistPdfDays } from "./checklist-pdf";
import { CHECKLIST_SCHEMA_VERSION, type ChecklistRecord } from "./record";

function sample(type: ChecklistRecord["type"], id: string): ChecklistRecord {
  return {
    id,
    type,
    schemaVersion: CHECKLIST_SCHEMA_VERSION,
    status: "completed",
    completedAtUtc: "2026-08-01T02:00:00.000Z",
    items: [{ code: "x", kind: "acknowledge", value: "acknowledged" }],
    signatures: [
      {
        role: "driver",
        pngDataUrl: "data:image/png;base64,aaa",
        signedAtUtc: "2026-08-01T02:00:00.000Z",
        signedAtAwst: "01/08/2026, 10:00:00 am",
        lat: null,
        lng: null,
        accuracyM: null,
      },
    ],
  };
}

describe("collectChecklistPdfDays", () => {
  it("skips days without completed records", () => {
    const days = collectChecklistPdfDays({
      weekStarting: "2026-07-26",
      days: [{}, { checklists: [sample("ffw", "1")] }, {}],
    });
    expect(days).toHaveLength(1);
    expect(days[0]!.dayIndex).toBe(1);
    expect(days[0]!.records).toHaveLength(1);
  });

  it("filters to a single dayIndex", () => {
    const days = collectChecklistPdfDays({
      weekStarting: "2026-07-26",
      dayIndex: 0,
      days: [
        { checklists: [sample("ffw", "a")] },
        { checklists: [sample("prestart", "b")] },
      ],
    });
    expect(days).toHaveLength(1);
    expect(days[0]!.dayIndex).toBe(0);
  });
});
