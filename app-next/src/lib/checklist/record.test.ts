import { describe, it, expect } from "vitest";
import {
  appendChecklistToDay,
  deriveTripChecklistFields,
} from "./derive-trip-ticks";
import {
  CHECKLIST_SCHEMA_VERSION,
  validateCompletedChecklistRecord,
  type ChecklistRecord,
} from "./record";

function sampleFfw(overrides: Partial<ChecklistRecord> = {}): ChecklistRecord {
  return {
    id: "ck_ffw_1",
    type: "ffw",
    schemaVersion: CHECKLIST_SCHEMA_VERSION,
    status: "completed",
    completedAtUtc: "2026-07-31T02:00:00.000Z",
    items: [{ code: "ffw_01", kind: "acknowledge", value: "acknowledged" }],
    signatures: [
      {
        role: "driver",
        pngDataUrl: "data:image/png;base64,aaa",
        signedAtUtc: "2026-07-31T02:00:00.000Z",
        signedAtAwst: "31/07/2026, 10:00:00 am",
        lat: null,
        lng: null,
        accuracyM: null,
      },
    ],
    ...overrides,
  };
}

describe("validateCompletedChecklistRecord", () => {
  it("accepts a minimal completed FFW record", () => {
    const v = validateCompletedChecklistRecord(sampleFfw());
    expect(v.ok).toBe(true);
  });

  it("rejects Fail without defect text", () => {
    const v = validateCompletedChecklistRecord(
      sampleFfw({
        type: "prestart",
        items: [{ code: "ps_tyre", kind: "pass_fail", value: "fail", defect: null }],
      })
    );
    expect(v.ok).toBe(false);
  });

  it("rejects loader signature without present/self path (no proxy)", () => {
    const base = sampleFfw({
      type: "dimension_load",
      loaderPath: "not_obtained",
      evidencePhotoDataUrls: ["data:image/jpeg;base64,bbb"],
      signatures: [
        {
          role: "driver",
          pngDataUrl: "data:image/png;base64,aaa",
          signedAtUtc: "2026-07-31T02:00:00.000Z",
          signedAtAwst: "x",
          lat: null,
          lng: null,
          accuracyM: null,
        },
        {
          role: "loader",
          pngDataUrl: "data:image/png;base64,ccc",
          signedAtUtc: "2026-07-31T02:00:00.000Z",
          signedAtAwst: "x",
          lat: null,
          lng: null,
          accuracyM: null,
        },
      ],
    });
    const v = validateCompletedChecklistRecord(base);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors.some((e) => e.code === "loader")).toBe(true);
  });

  it("requires evidence photos when loader not_obtained", () => {
    const v = validateCompletedChecklistRecord(
      sampleFfw({
        type: "dimension_load",
        loaderPath: "not_obtained",
        evidencePhotoDataUrls: [],
        items: [{ code: "load_1", kind: "pass_fail", value: "pass" }],
      })
    );
    expect(v.ok).toBe(false);
  });
});

describe("deriveTripChecklistFields", () => {
  it("sets FFW tick from completed ffw record", () => {
    const ticks = deriveTripChecklistFields({ checklists: [sampleFfw()] });
    expect(ticks.fitness_for_work).toBe(true);
    expect(ticks.daily_vehicle_checklist).toBe(false);
  });

  it("preserves legacy boolean when no completed record of that type", () => {
    const ticks = deriveTripChecklistFields({
      fitness_for_work: true,
      checklists: [],
    });
    expect(ticks.fitness_for_work).toBe(true);
  });

  it("appendChecklistToDay derives ticks", () => {
    const next = appendChecklistToDay({}, sampleFfw());
    expect(next.checklists).toHaveLength(1);
    expect(next.fitness_for_work).toBe(true);
  });
});
