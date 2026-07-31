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
    items: [
      { code: "ps_tyre_pressure", label: "Tyre pressure" },
      { code: "ps_tread", label: "Tread depth" },
      { code: "ps_wheel_nuts", label: "Wheel nut security" },
      { code: "ps_hubs", label: "Hub integrity" },
    ],
  },
  {
    code: "vision",
    label: "Vision & glass",
    items: [
      { code: "ps_windscreen", label: "Windscreen integrity" },
      { code: "ps_mirrors", label: "Mirrors secure and clean" },
      { code: "ps_wipers", label: "Wipers and washers" },
    ],
  },
  {
    code: "lights",
    label: "Lights & reflectors",
    items: [
      { code: "ps_headlights", label: "Headlights" },
      { code: "ps_clearance", label: "Clearance lights" },
      { code: "ps_indicators", label: "Indicators" },
      { code: "ps_brake_lights", label: "Brake lights" },
      { code: "ps_lenses", label: "Lenses / reflectors" },
    ],
  },
  {
    code: "structure",
    label: "Structure & fluids",
    items: [
      { code: "ps_frame", label: "Frame / body panels" },
      { code: "ps_posture", label: "Posture / tilt" },
      { code: "ps_signs", label: "Signs / plates" },
      { code: "ps_leaks", label: "Oil / coolant / air / hydraulic leaks" },
    ],
  },
  {
    code: "brakes",
    label: "Brakes & air",
    items: [
      { code: "ps_brake_warn", label: "Failure indicators" },
      { code: "ps_air_drain", label: "Air tank drain" },
      { code: "ps_gauges", label: "Gauges" },
    ],
  },
  {
    code: "engine",
    label: "Engine & coupling",
    items: [
      { code: "ps_belts", label: "Belts / pulleys" },
      { code: "ps_fifth", label: "Turntable / fifth-wheel security" },
    ],
  },
  {
    code: "safety",
    label: "Safety gear",
    items: [
      { code: "ps_first_aid", label: "First aid kit" },
      { code: "ps_extinguisher", label: "Fire extinguisher" },
      { code: "ps_triangles", label: "Warning triangles" },
      { code: "ps_ppe", label: "PPE" },
    ],
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
