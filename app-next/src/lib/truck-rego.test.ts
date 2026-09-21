import { describe, expect, it } from "vitest";
import {
  formatTruckRegoMassLine,
  formatTruckRegoSelectLabel,
  formatTruckRegoSummary,
  hookupSuggestedForPlate,
  parseTruckRegoCreate,
  parseTruckRegoPatch,
  serializeTruckRego,
  truckRegoMetadataComplete,
} from "./truck-rego";

describe("truck-rego metadata", () => {
  it("requires GVM, GCM, tare, and axles on a powered vehicle", () => {
    expect(parseTruckRegoCreate({ label: "1ABC 234" })).toEqual({
      error: "Type is required",
    });
    expect(
      parseTruckRegoCreate({
        label: "1ABC 234",
        vehicle_type: "prime_mover",
        gvm_tonnes: 24.5,
        gcm_tonnes: 68.5,
        tare_tonnes: 9.2,
        axle_count: 3,
        wahva_accredited: true,
      })
    ).toEqual({
      label: "1ABC 234",
      vehicleType: "prime_mover",
      gvmTonnes: 24.5,
      gcmTonnes: 68.5,
      atmTonnes: null,
      tareTonnes: 9.2,
      axleCount: 3,
      wahvaAccredited: true,
      sortOrder: undefined,
    });
  });

  it("requires ATM and tare on a trailer, not GVM or GCM", () => {
    expect(
      parseTruckRegoCreate({
        label: "1TRL 001",
        vehicle_type: "trailer",
        tare_tonnes: 7.5,
        axle_count: 3,
        wahva_accredited: false,
      })
    ).toEqual({ error: "ATM (t) is required" });
    expect(
      parseTruckRegoCreate({
        label: "1TRL 001",
        vehicle_type: "trailer",
        atm_tonnes: 38,
        tare_tonnes: 7.5,
        axle_count: 3,
        wahva_accredited: false,
      })
    ).toEqual({
      label: "1TRL 001",
      vehicleType: "trailer",
      gvmTonnes: null,
      gcmTonnes: null,
      atmTonnes: 38,
      tareTonnes: 7.5,
      axleCount: 3,
      wahvaAccredited: false,
      sortOrder: undefined,
    });
  });

  it("rejects invalid type, mass, and axle count", () => {
    expect(
      parseTruckRegoCreate({
        label: "1ABC",
        vehicle_type: "ute",
        gvm_tonnes: 10,
        gcm_tonnes: 10,
        tare_tonnes: 4,
        axle_count: 2,
        wahva_accredited: false,
      })
    ).toEqual({ error: "Type must be Prime mover, Rigid, Van, Trailer, or Other" });
    expect(parseTruckRegoPatch({ gvm_tonnes: 0 })).toEqual({
      error: "GVM (t) must be a positive number in metric tonnes",
    });
    expect(parseTruckRegoPatch({ axle_count: 21 })).toEqual({
      error: "Number of axles must be a whole number from 1 to 20",
    });
  });

  it("clears GVM/GCM when type is patched to trailer", () => {
    expect(
      parseTruckRegoPatch({
        vehicle_type: "trailer",
        atm_tonnes: 38,
        tare_tonnes: 7,
      })
    ).toEqual({
      vehicleType: "trailer",
      gvmTonnes: null,
      gcmTonnes: null,
      atmTonnes: 38,
      tareTonnes: 7,
    });
  });

  it("marks incomplete catalogue rows until type-relevant masses are filled", () => {
    expect(
      truckRegoMetadataComplete({
        vehicleType: "rigid",
        gvmTonnes: 24,
        gcmTonnes: null,
        atmTonnes: null,
        tareTonnes: 8,
        axleCount: 2,
      })
    ).toBe(false);
    expect(
      formatTruckRegoSummary({
        vehicleType: "rigid",
        gvmTonnes: 24,
        gcmTonnes: 45,
        atmTonnes: null,
        tareTonnes: 8,
        axleCount: 2,
        wahvaAccredited: false,
      })
    ).toBe("Rigid · GVM 24 t · GCM 45 t · Tare 8 t · 2 axles · Not WAHVA accredited");
  });

  it("lists only the masses that apply next to a plate", () => {
    expect(
      formatTruckRegoMassLine({
        vehicleType: "prime_mover",
        gvmTonnes: 24.5,
        gcmTonnes: 68.5,
        atmTonnes: 99,
        tareTonnes: 9.2,
      })
    ).toBe("GVM 24.5 t · GCM 68.5 t · Tare 9.2 t");
    expect(
      formatTruckRegoMassLine({
        vehicleType: "trailer",
        gvmTonnes: 24,
        gcmTonnes: 68,
        atmTonnes: 38,
        tareTonnes: 7.5,
      })
    ).toBe("ATM 38 t · Tare 7.5 t");
    expect(
      formatTruckRegoSelectLabel("1ABC 234", {
        vehicleType: "van",
        gvmTonnes: 4.5,
        gcmTonnes: 4.5,
        atmTonnes: null,
        tareTonnes: 2.1,
      })
    ).toBe("1ABC 234 · Van · GVM 4.5 t · GCM 4.5 t · Tare 2.1 t");
  });

  it("suggests Hook up only for a prime-mover plate", () => {
    const regos = [
      { label: "1ABC 234", vehicle_type: "prime_mover" as const },
      { label: "2XYZ 567", vehicle_type: "rigid" as const },
    ];
    expect(hookupSuggestedForPlate(regos, "1abc 234")).toBe(true);
    expect(hookupSuggestedForPlate(regos, "2XYZ 567")).toBe(false);
    expect(hookupSuggestedForPlate(regos, "")).toBe(false);
  });

  it("serializes API rows in snake_case and falls back to the old combined mass", () => {
    expect(
      serializeTruckRego({
        id: "r1",
        label: "1HSX204",
        sortOrder: 0,
        vehicleType: "van",
        gvmTonnes: null,
        gcmTonnes: null,
        atmTonnes: null,
        tareTonnes: 2.1,
        axleCount: null,
        gvmGcmTonnes: 4.5,
        axleGroups: 2,
        wahvaAccredited: false,
      })
    ).toEqual({
      id: "r1",
      label: "1HSX204",
      sort_order: 0,
      vehicle_type: "van",
      gvm_tonnes: 4.5,
      gcm_tonnes: null,
      atm_tonnes: null,
      tare_tonnes: 2.1,
      axle_count: 2,
      wahva_accredited: false,
    });
  });
});
