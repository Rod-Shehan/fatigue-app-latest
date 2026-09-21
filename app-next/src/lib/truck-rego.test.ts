import { describe, expect, it } from "vitest";
import {
  formatTruckRegoSummary,
  parseTruckRegoCreate,
  parseTruckRegoPatch,
  serializeTruckRego,
  truckRegoMetadataComplete,
} from "./truck-rego";

describe("truck-rego metadata", () => {
  it("requires type, GVM/GCM, axle groups, and WAHVA flag on create", () => {
    expect(parseTruckRegoCreate({ label: "1ABC 234" })).toEqual({
      error: "Type is required",
    });
    expect(
      parseTruckRegoCreate({
        label: "1ABC 234",
        vehicle_type: "prime_mover",
        gvm_gcm_tonnes: 68.5,
        axle_groups: 3,
        wahva_accredited: true,
      })
    ).toEqual({
      label: "1ABC 234",
      vehicleType: "prime_mover",
      gvmGcmTonnes: 68.5,
      axleGroups: 3,
      wahvaAccredited: true,
      sortOrder: undefined,
    });
  });

  it("rejects invalid type, mass, and axle groups", () => {
    expect(
      parseTruckRegoCreate({
        label: "1ABC",
        vehicle_type: "ute",
        gvm_gcm_tonnes: 10,
        axle_groups: 2,
        wahva_accredited: false,
      })
    ).toEqual({ error: "Type must be Prime mover, Rigid, Van, or Other" });
    expect(parseTruckRegoPatch({ gvm_gcm_tonnes: 0 })).toEqual({
      error: "GVM / GCM (t) must be a positive number in metric tonnes",
    });
    expect(parseTruckRegoPatch({ axle_groups: 5 })).toEqual({
      error: "Axle groups must be 2, 3, or 4",
    });
  });

  it("marks incomplete catalogue rows until details are filled", () => {
    expect(
      truckRegoMetadataComplete({
        vehicleType: null,
        gvmGcmTonnes: null,
        axleGroups: null,
      })
    ).toBe(false);
    expect(
      formatTruckRegoSummary({
        vehicleType: "rigid",
        gvmGcmTonnes: 24,
        axleGroups: 2,
        wahvaAccredited: false,
      })
    ).toBe("Rigid · 24 t · 2 axle groups · Not WAHVA accredited");
  });

  it("serializes API rows in snake_case", () => {
    expect(
      serializeTruckRego({
        id: "r1",
        label: "1HSX204",
        sortOrder: 0,
        vehicleType: "van",
        gvmGcmTonnes: 4.5,
        axleGroups: 2,
        wahvaAccredited: false,
      })
    ).toEqual({
      id: "r1",
      label: "1HSX204",
      sort_order: 0,
      vehicle_type: "van",
      gvm_gcm_tonnes: 4.5,
      axle_groups: 2,
      wahva_accredited: false,
    });
  });
});
