import { describe, it, expect } from "vitest";
import {
  appendChecklistToDay,
  deriveTripChecklistFields,
  type DayWithChecklists,
} from "./derive-trip-ticks";
import {
  CHECKLIST_SCHEMA_VERSION,
  listCompletedChecklistsOfType,
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

  it("requires loaderPath on dimension_load", () => {
    const v = validateCompletedChecklistRecord(
      sampleFfw({
        type: "dimension_load",
        loaderPath: null,
        items: [{ code: "load_1", kind: "pass_fail", value: "pass" }],
      })
    );
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors.some((e) => e.code === "loaderPath")).toBe(true);
  });

  it("accepts dimension_load pending with loader name and driver-only signature", () => {
    const v = validateCompletedChecklistRecord(
      sampleFfw({
        type: "dimension_load",
        loaderPath: "pending",
        loaderName: "Sam Loader",
        items: [{ code: "load_1", kind: "pass_fail", value: "pass" }],
      })
    );
    expect(v.ok).toBe(true);
  });

  it("accepts dimension_load self_as_loader with dual signatures", () => {
    const driver = sampleFfw().signatures[0]!;
    const v = validateCompletedChecklistRecord(
      sampleFfw({
        type: "dimension_load",
        loaderPath: "self_as_loader",
        loaderName: "Driver (self-loaded)",
        items: [{ code: "load_1", kind: "pass_fail", value: "pass" }],
        signatures: [driver, { ...driver, role: "loader" }],
      })
    );
    expect(v.ok).toBe(true);
  });

  it("rejects self_as_loader without separate loader signature", () => {
    const v = validateCompletedChecklistRecord(
      sampleFfw({
        type: "dimension_load",
        loaderPath: "self_as_loader",
        items: [{ code: "load_1", kind: "pass_fail", value: "pass" }],
      })
    );
    expect(v.ok).toBe(false);
  });

  it("accepts not-responsible prestart with skip reason and empty items", () => {
    const v = validateCompletedChecklistRecord(
      sampleFfw({
        type: "prestart",
        items: [],
        prestartResponsible: false,
        prestartSkipReason: "Two-up — other driver did prestart",
      })
    );
    expect(v.ok).toBe(true);
  });

  it("rejects not-responsible prestart without skip reason", () => {
    const v = validateCompletedChecklistRecord(
      sampleFfw({
        type: "prestart",
        items: [],
        prestartResponsible: false,
        prestartSkipReason: "",
      })
    );
    expect(v.ok).toBe(false);
  });

  it("rejects not-responsible prestart that invents item answers", () => {
    const v = validateCompletedChecklistRecord(
      sampleFfw({
        type: "prestart",
        items: [{ code: "ps_tyre", kind: "pass_fail", value: "pass" }],
        prestartResponsible: false,
        prestartSkipReason: "two-up",
      })
    );
    expect(v.ok).toBe(false);
  });

  it("requires actionedFaultText when prestart has a Fault", () => {
    const v = validateCompletedChecklistRecord(
      sampleFfw({
        type: "prestart",
        prestartResponsible: true,
        items: [
          {
            code: "wheels",
            kind: "pass_fail",
            value: "fail",
            defect: {
              description: "Soft tyre",
              photoDataUrls: [],
              mobilityStatus: "can_drive",
            },
          },
        ],
        actionedFaultText: "",
      })
    );
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors.some((e) => e.code === "actionedFaultText")).toBe(true);
  });

  it("accepts prestart Fault with actionedFaultText", () => {
    const v = validateCompletedChecklistRecord(
      sampleFfw({
        type: "prestart",
        prestartResponsible: true,
        items: [
          {
            code: "wheels",
            kind: "pass_fail",
            value: "fail",
            defect: {
              description: "Soft tyre",
              photoDataUrls: [],
              mobilityStatus: "can_drive",
            },
          },
        ],
        actionedFaultText: "Wheels & tyres: Soft tyre",
      })
    );
    expect(v.ok).toBe(true);
  });
});

describe("deriveTripChecklistFields", () => {
  it("sets FFW tick from completed ffw record", () => {
    const ticks = deriveTripChecklistFields({ checklists: [sampleFfw()] });
    expect(ticks.fitness_for_work).toBe(true);
    expect(ticks.daily_vehicle_checklist).toBe(false);
  });

  it("sets vehicle tick from responsible prestart only", () => {
    const responsible = sampleFfw({
      type: "prestart",
      prestartResponsible: true,
      items: [{ code: "ps_tyre", kind: "pass_fail", value: "pass" }],
    });
    expect(deriveTripChecklistFields({ checklists: [responsible] }).daily_vehicle_checklist).toBe(
      true
    );

    const skipped = sampleFfw({
      type: "prestart",
      items: [],
      prestartResponsible: false,
      prestartSkipReason: "Two-up",
    });
    expect(deriveTripChecklistFields({ checklists: [skipped] }).daily_vehicle_checklist).toBe(false);
  });

  it("preserves legacy boolean when no completed record of that type", () => {
    const ticks = deriveTripChecklistFields({
      fitness_for_work: true,
      checklists: [],
    });
    expect(ticks.fitness_for_work).toBe(true);
  });

  it("appendChecklistToDay derives ticks", () => {
    const next = appendChecklistToDay({} as DayWithChecklists, sampleFfw());
    expect(next.checklists).toHaveLength(1);
    expect(next.fitness_for_work).toBe(true);
  });

  it("listCompletedChecklistsOfType returns oldest to newest of one type", () => {
    const a = sampleFfw({ id: "a", completedAtUtc: "2026-07-31T01:00:00.000Z" });
    const b = sampleFfw({ id: "b", completedAtUtc: "2026-07-31T03:00:00.000Z" });
    const load = sampleFfw({
      id: "c",
      type: "dimension_load",
      loaderPath: "pending",
      loaderName: "Sam",
      completedAtUtc: "2026-07-31T02:00:00.000Z",
      items: [{ code: "load_1", kind: "pass_fail", value: "pass" }],
    });
    const list = listCompletedChecklistsOfType([b, load, a], "ffw");
    expect(list.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
