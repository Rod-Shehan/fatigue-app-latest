/**
 * Schema stubs for Phase 1 demo only — final legal copy reviewed in later phases.
 */

import type { ChecklistSchemaGroup, ChecklistSchemaItem } from "./item-types";

export const FFW_SCHEMA_STUB: ChecklistSchemaItem[] = [
  { code: "ffw_01", label: "I understand confidential reporting of fitness concerns is available." },
  { code: "ffw_02", label: "I am physically well enough to drive; no unmanaged injury or illness." },
  { code: "ffw_03", label: "Prescribed medications are reported and medical letters are held where required." },
  { code: "ffw_04", label: "I am not under the influence of illicit drugs or alcohol." },
  { code: "ffw_05", label: "I consent to random drug and alcohol testing as required by company policy." },
  { code: "ffw_06", label: "I have had sufficient quality sleep and can report fatigue without penalty." },
  { code: "ffw_07", label: "I have no unreported secondary employment that affects safe driving." },
  { code: "ffw_08", label: "My stress levels do not impair safe vehicle operation." },
  { code: "ffw_09", label: "I have adequate food and water provisions for this shift." },
  { code: "ffw_10", label: "I agree to report external workplace issues that affect fitness for work." },
];

export const PRESTART_SCHEMA_STUB: ChecklistSchemaGroup[] = [
  {
    code: "wheels",
    label: "Wheels & tyres",
    notes: ["Tyre and tread depth", "Wheel nut security", "Hub integrity"],
  },
  {
    code: "vision",
    label: "Vision & glass",
    notes: ["Windscreen integrity", "Mirrors secure and clean", "Wipers and washers"],
  },
  {
    code: "lights",
    label: "Lights & reflectors",
    notes: ["Headlights", "Clearance lights", "Indicators", "Brake lights", "Lenses / reflectors"],
  },
  {
    code: "suspension",
    label: "Suspension & chassis",
    notes: [
      "Posture / tilt",
      "Frame / body panels",
      "Turntable / fifth-wheel security",
      "Signs / plates",
    ],
  },
  {
    code: "brakes",
    label: "Brakes & air",
    notes: ["Air leaks", "Air tank drain", "Gauges"],
  },
  {
    code: "engine",
    label: "Engine & fluids",
    notes: ["Belts / pulleys", "Oil / coolant / air / hydraulic leaks"],
  },
  {
    code: "safety",
    label: "Safety gear",
    notes: ["First aid kit", "Fire extinguisher", "Warning triangles", "Jack and wheel brace"],
  },
];

export const LOAD_SCHEMA_STUB: ChecklistSchemaItem[] = [
  {
    code: "load_dimensions",
    label: "Vehicle within regulated dimensions (or notice/permit attached)",
  },
  {
    code: "load_route",
    label: "Route authorized under notice/permit (RAV Network check)",
  },
  {
    code: "load_secured",
    label: "Load properly secured; restraint equipment load-rated and in good condition",
  },
  {
    code: "load_cog",
    label: "Load positioning & centre of gravity preserves vehicle stability",
  },
  {
    code: "load_dunnage",
    label: "Dunnage chosen, positioned, and restrained correctly",
  },
];
