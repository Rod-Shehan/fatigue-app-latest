import { describe, expect, it } from "vitest";
import {
  checklistAuditIdentity,
  formatLoadCombinationLine,
  lastLoadCombinationFromRecords,
  loadAuditVehicleRego,
  serializeLoadCombinationHeader,
} from "./audit-identity";
import { CHECKLIST_SCHEMA_VERSION, type ChecklistRecord } from "./record";

const sig = {
  role: "driver" as const,
  pngDataUrl: "data:image/png;base64,aaa",
  signedAtUtc: "2026-08-20T02:00:00.000Z",
  signedAtAwst: "20/08/2026, 10:00:00 am",
  lat: null,
  lng: null,
  accuracyM: null,
};

function loadRecord(header: ChecklistRecord["header"]): ChecklistRecord {
  return {
    id: "ck_load_1",
    type: "dimension_load",
    schemaVersion: CHECKLIST_SCHEMA_VERSION,
    status: "completed",
    completedAtUtc: "2026-08-20T02:00:00.000Z",
    items: [],
    signatures: [sig],
    header,
  };
}

describe("checklist audit identity", () => {
  it("FFW is keyed by driver name", () => {
    const id = checklistAuditIdentity({
      id: "1",
      type: "ffw",
      schemaVersion: 1,
      status: "completed",
      completedAtUtc: "x",
      items: [],
      signatures: [sig],
      header: { driver_name: "Jaydin Ireland" },
    });
    expect(id.primaryLabel).toBe("Driver");
    expect(id.primaryValue).toBe("Jaydin Ireland");
  });

  it("Prestart is keyed by vehicle, driver second", () => {
    const id = checklistAuditIdentity({
      id: "1",
      type: "prestart",
      schemaVersion: 1,
      status: "completed",
      completedAtUtc: "x",
      items: [],
      signatures: [sig],
      header: { vehicle_rego: "1ABC123", driver_name: "Jaydin Ireland" },
    });
    expect(id.primaryLabel).toBe("Vehicle");
    expect(id.primaryValue).toBe("1ABC123");
    expect(id.secondaryValue).toBe("Jaydin Ireland");
  });

  it("Load audit vehicle prefers trailer over prime mover", () => {
    expect(
      loadAuditVehicleRego({
        truckRego: "PRIME1",
        units: [
          { role: "trailer", rego: "TRL9" },
          { role: "dolly", rego: "DOL1" },
        ],
      })
    ).toBe("TRL9");
  });

  it("serializes multi-trailer combination and keeps first trailer_rego for old readers", () => {
    const header = serializeLoadCombinationHeader({
      truckRego: "PRIME1",
      units: [
        { role: "trailer", rego: "A1" },
        { role: "trailer", rego: "B2" },
        { role: "dolly", rego: "D3" },
      ],
      driverName: "Jaydin",
      client: "MineCo",
    });
    expect(header.trailer_rego).toBe("A1");
    expect(header.trailer_regos).toBe("A1, B2");
    expect(header.dolly_regos).toBe("D3");
    expect(header.audit_vehicle).toBe("A1");
    expect(header.combination).toBe("Prime PRIME1 + Trailer A1 + Trailer B2 + Dolly D3");
    expect(formatLoadCombinationLine({ truckRego: "PRIME1", units: [] })).toBe("Prime PRIME1");
  });

  it("prefills the next load check from the last record that day", () => {
    const last = lastLoadCombinationFromRecords([
      loadRecord({ truck_rego: "T1", trailer_regos: "X, Y", dolly_regos: "Z" }),
    ]);
    expect(last?.truckRego).toBe("T1");
    expect(last?.units).toEqual([
      { role: "trailer", rego: "X" },
      { role: "trailer", rego: "Y" },
      { role: "dolly", rego: "Z" },
    ]);
  });
});
