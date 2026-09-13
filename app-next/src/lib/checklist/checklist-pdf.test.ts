import { describe, it, expect } from "vitest";
import {
  checklistPdfFilename,
  checklistPdfIdentity,
  checklistPdfWeekEndingFileToken,
  collectChecklistPdfDays,
  uniqueChecklistPdfFilename,
} from "./checklist-pdf";
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

  it("keeps vehicle, trailer, and forklift pre-departure in separate packs", () => {
    const source = [
      {
        checklists: [
          sample("prestart", "v"),
          sample("prestart_trailer", "t"),
          sample("prestart_forklift", "f"),
        ],
      },
    ];
    expect(
      collectChecklistPdfDays({ weekStarting: "2026-07-26", type: "prestart", days: source })[0]!
        .records.map((r) => r.type)
    ).toEqual(["prestart"]);
    expect(
      collectChecklistPdfDays({
        weekStarting: "2026-07-26",
        type: "prestart_trailer",
        days: source,
      })[0]!.records.map((r) => r.type)
    ).toEqual(["prestart_trailer"]);
    expect(
      collectChecklistPdfDays({
        weekStarting: "2026-07-26",
        type: "prestart_forklift",
        days: source,
      })[0]!.records.map((r) => r.type)
    ).toEqual(["prestart_forklift"]);
  });

  it("keeps hook-up in its own pack", () => {
    const source = [
      {
        checklists: [sample("prestart", "v"), sample("hookup", "h"), sample("dimension_load", "l")],
      },
    ];
    expect(
      collectChecklistPdfDays({ weekStarting: "2026-07-26", type: "hookup", days: source })[0]!
        .records.map((r) => r.type)
    ).toEqual(["hookup"]);
  });
});

describe("checklist PDF filing name", () => {
  const weekStarting = "2026-07-26";

  it("uses week ending, not week starting or signed time", () => {
    expect(checklistPdfWeekEndingFileToken(weekStarting)).toBe("01-08-2026");
    const name = checklistPdfFilename({
      weekStarting,
      type: "ffw",
      driverName: "Jaydin Ireland",
      record: sample("ffw", "1"),
    });
    expect(name).toBe("Fitness-for-Work_Jaydin-Ireland_week-ending-01-08-2026.pdf");
    expect(name).not.toContain("2026-07-26");
    expect(name).not.toContain("10:00");
  });

  it("names Fitness for Work per driver", () => {
    const record = sample("ffw", "1");
    record.header = { driver_name: "Jaydin Ireland" };
    expect(checklistPdfIdentity(record).titleLine).toBe("Driver: Jaydin Ireland");
    expect(
      checklistPdfFilename({ weekStarting, type: "ffw", record })
    ).toBe("Fitness-for-Work_Jaydin-Ireland_week-ending-01-08-2026.pdf");
  });

  it("names vehicle and load checks per vehicle rego", () => {
    const vehicle = sample("prestart", "v");
    vehicle.header = { vehicle_rego: "1ABC123", driver_name: "Jaydin" };
    expect(checklistPdfIdentity(vehicle).titleLine).toBe("Vehicle: 1ABC123");
    expect(
      checklistPdfFilename({ weekStarting, type: "prestart", record: vehicle })
    ).toBe("Vehicle-pre-departure_1ABC123_week-ending-01-08-2026.pdf");

    const load = sample("dimension_load", "l");
    load.header = { truck_rego: "PRIME1", trailer_rego: "TRL9" };
    expect(checklistPdfIdentity(load).fileStem).toBe("PRIME1");
    expect(
      checklistPdfFilename({ weekStarting, type: "dimension_load", record: load })
    ).toBe("Load-check_PRIME1_week-ending-01-08-2026.pdf");
  });

  it("names hook-up per driver and rego", () => {
    const hook = sample("hookup", "h");
    hook.header = { driver_name: "Jaydin Ireland", truck_rego: "PRIME1", trailer_rego: "TRL9" };
    expect(checklistPdfIdentity(hook).titleLine).toBe(
      "Driver: Jaydin Ireland  ·  Vehicle: PRIME1-TRL9"
    );
    expect(
      checklistPdfFilename({ weekStarting, type: "hookup", record: hook })
    ).toBe("Hook-up_Jaydin-Ireland_PRIME1-TRL9_week-ending-01-08-2026.pdf");
  });

  it("suffixes a second log with the same filing name", () => {
    const used = new Set<string>();
    const a = uniqueChecklistPdfFilename(
      "Fitness-for-Work_Jaydin-Ireland_week-ending-01-08-2026.pdf",
      used
    );
    const b = uniqueChecklistPdfFilename(
      "Fitness-for-Work_Jaydin-Ireland_week-ending-01-08-2026.pdf",
      used
    );
    expect(a).toBe("Fitness-for-Work_Jaydin-Ireland_week-ending-01-08-2026.pdf");
    expect(b).toBe("Fitness-for-Work_Jaydin-Ireland_week-ending-01-08-2026-2.pdf");
  });
});
