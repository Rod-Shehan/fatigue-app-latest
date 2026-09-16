import { describe, expect, it } from "vitest";
import {
  FFW_SCHEMA_STUB,
  FORKLIFT_PRESTART_SCHEMA,
  HOOKUP_SCHEMA,
  LOAD_SCHEMA_STUB,
  PRESTART_SCHEMA_STUB,
  TRAILER_PRESTART_SCHEMA,
  buildFfwSchema,
} from "./schema-stubs";

const VEHICLE_NA = [
  "ext_air_tanks",
  "ext_turntable",
  "ext_extinguisher",
  "ext_curtains",
  "ext_fuel_caps",
];

const TRAILER_NA = [
  "trl_kingpin",
  "trl_legs",
  "trl_curtains",
  "trl_restraint",
  "trl_rear_doors",
  "trl_ringfeder",
  "trl_extinguisher",
];

const FORKLIFT_NA = ["fl_fluids", "fl_attachments", "fl_extinguisher"];

function expectNaOnly(
  schema: Array<{ code: string; naAllowed?: boolean }>,
  naOnly: string[]
) {
  const naCodes = schema.filter((g) => g.naAllowed).map((g) => g.code);
  expect(naCodes).toEqual(naOnly);
  for (const group of schema) {
    if (!naOnly.includes(group.code)) {
      expect(group.naAllowed).toBeFalsy();
    }
  }
}

describe("PRESTART_SCHEMA_STUB (WAHVA vehicle)", () => {
  it("lists 27 vehicle items and is not merged with trailer or forklift", () => {
    const codes = PRESTART_SCHEMA_STUB.map((g) => g.code);
    expect(codes).toHaveLength(27);
    expect(codes.some((c) => c.startsWith("trl_") || c.startsWith("fl_"))).toBe(false);
  });

  it("offers N/A only on items that are not on every vehicle type", () => {
    expectNaOnly(PRESTART_SCHEMA_STUB, VEHICLE_NA);
  });
});

describe("TRAILER_PRESTART_SCHEMA (WAHVA trailer)", () => {
  it("lists 17 trailer items in paper order", () => {
    expect(TRAILER_PRESTART_SCHEMA.map((g) => g.code)).toEqual([
      "trl_posture",
      "trl_air_elec",
      "trl_kingpin",
      "trl_legs",
      "trl_curtains",
      "trl_restraint",
      "trl_suspension",
      "trl_rear_doors",
      "trl_tyres",
      "trl_hubs",
      "trl_ringfeder",
      "trl_mudguards",
      "trl_body",
      "trl_plates",
      "trl_extinguisher",
      "trl_lights",
      "trl_air_brakes",
    ]);
  });

  it("offers N/A only on items that are not on every trailer", () => {
    expectNaOnly(TRAILER_PRESTART_SCHEMA, TRAILER_NA);
  });
});

describe("FORKLIFT_PRESTART_SCHEMA (WAHVA forklift)", () => {
  it("lists 15 forklift items in paper order", () => {
    expect(FORKLIFT_PRESTART_SCHEMA.map((g) => g.code)).toEqual([
      "fl_tyres",
      "fl_fluids",
      "fl_seat",
      "fl_warning",
      "fl_capacity",
      "fl_mast",
      "fl_hydraulics",
      "fl_tines",
      "fl_guarding",
      "fl_attachments",
      "fl_controls",
      "fl_brakes",
      "fl_extinguisher",
      "fl_dash",
      "fl_service",
    ]);
  });

  it("offers N/A only on items that are not on every forklift", () => {
    expectNaOnly(FORKLIFT_PRESTART_SCHEMA, FORKLIFT_NA);
  });
});

describe("buildFfwSchema (WAHVA Fitness for Work)", () => {
  it("lists 10 declaration points in paper order, all mandatory", () => {
    expect(FFW_SCHEMA_STUB.map((i) => i.code)).toEqual([
      "ffw_01",
      "ffw_02",
      "ffw_03",
      "ffw_04",
      "ffw_05",
      "ffw_06",
      "ffw_07",
      "ffw_08",
      "ffw_09",
      "ffw_10",
    ]);
    expectNaOnly(FFW_SCHEMA_STUB, []);
  });

  it("uses the organisation name in management wording when provided", () => {
    const items = buildFfwSchema("MTS");
    expect(items[0]!.notes?.[0]).toMatch(/MTS management remains confidential/);
    expect(items[2]!.label).toContain("MTS");
    expect(items[6]!.notes?.[0]).toContain("outside of MTS");
  });
});

describe("LOAD_SCHEMA_STUB (WAHVA load-check day row)", () => {
  it("lists the six day-row columns in paper order", () => {
    expect(LOAD_SCHEMA_STUB.map((i) => i.code)).toEqual([
      "load_permits",
      "load_dimensions",
      "load_security",
      "load_stability",
      "load_suitability",
      "load_dunnage",
    ]);
  });

  it("offers N/A only on Permits and Dunnage / friction", () => {
    expectNaOnly(LOAD_SCHEMA_STUB, ["load_permits", "load_dunnage"]);
  });
});

describe("HOOKUP_SCHEMA (MTS hookup checklist)", () => {
  it("lists the fourteen paper steps in order", () => {
    expect(HOOKUP_SCHEMA.map((i) => i.code)).toEqual([
      "hook_01",
      "hook_02",
      "hook_03",
      "hook_04",
      "hook_05",
      "hook_06",
      "hook_07",
      "hook_08",
      "hook_09",
      "hook_10",
      "hook_11",
      "hook_12",
      "hook_13",
      "hook_14",
    ]);
  });

  it("uses the paper step wording and does not offer N/A", () => {
    expect(HOOKUP_SCHEMA.map((i) => i.label)).toEqual([
      "1. Checked turntable greased and jaws are open / handle is locked open. Air lines are clear of the turntable and deck.",
      "2. Reversed back to the trailer and stop short of.",
      "3. Applied handbrake and get out of truck.",
      "4. Checked the trailer alignment and turntable height before attempting to hook up. With airbags at neutral height, turntable must be at the same level as a trailer skid plate.",
      "5. Lowered the airbags (or raise trailer legs).",
      "6. Reversed under the trailer and stopped short of the kingpin.",
      "7. Raised airbags / wind up trailer legs to remove any gap between the turntable and the trailer.",
      "8. Applied handbrake and get out of truck.",
      "9. CRITICAL - Checked there is no gap between the turntable and the trailer.",
      "10. Reversed back under the trailer until locked then complete first tug test.",
      "11. Applied handbrake and get out of truck.",
      "12. CRITICAL - Checked there is no gap between the turntable and the trailer, handle and jaws are locked closed.",
      "13. Raised the trailer legs, stowed the leg handle, connected the leads and air lines.",
      "14. I have completed a second tug test.",
    ]);
    expectNaOnly(HOOKUP_SCHEMA, []);
  });
});
