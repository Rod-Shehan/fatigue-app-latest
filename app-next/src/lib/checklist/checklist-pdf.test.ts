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
  it("collects one type across the week", () => {
    const days = collectChecklistPdfDays({
      weekStarting: "2026-07-26",
      type: "ffw",
      days: [{}, { checklists: [sample("ffw", "1"), sample("prestart", "p")] }, {}],
    });
    expect(days).toHaveLength(1);
    expect(days[0]!.dayIndex).toBe(1);
    expect(days[0]!.records).toHaveLength(1);
    expect(days[0]!.records[0]!.type).toBe("ffw");
  });

  it("filters to a single dayIndex for that type", () => {
    const days = collectChecklistPdfDays({
      weekStarting: "2026-07-26",
      type: "ffw",
      dayIndex: 0,
      days: [
        { checklists: [sample("ffw", "a")] },
        { checklists: [sample("prestart", "b")] },
      ],
    });
    expect(days).toHaveLength(1);
    expect(days[0]!.dayIndex).toBe(0);
    expect(days[0]!.records.every((r) => r.type === "ffw")).toBe(true);
  });

  it("does not mix types in one pack", () => {
    const days = collectChecklistPdfDays({
      weekStarting: "2026-07-26",
      type: "prestart",
      days: [{ checklists: [sample("ffw", "a"), sample("prestart", "b")] }],
    });
    expect(days[0]!.records).toHaveLength(1);
    expect(days[0]!.records[0]!.type).toBe("prestart");
  });
});
