/**
 * WAHVA-accepted form copy. Pre-departure is three separate forms (vehicle, trailer,
 * forklift). FFW is the 10-point declaration. Load check is the six-column day row.
 * N/A is reserved for items that do not apply to every unit of that plant type.
 */

import type { ChecklistSchemaGroup, ChecklistSchemaItem } from "./item-types";

/** Driver-facing name — vehicle form. Persist type stays `prestart`. */
export const PRESTART_FORM_TITLE = "Vehicle pre-departure";
export const TRAILER_PRESTART_FORM_TITLE = "Trailer pre-departure";
export const FORKLIFT_PRESTART_FORM_TITLE = "Forklift pre-departure";

export type PrestartPlant = "vehicle" | "trailer" | "forklift";

/** Driver-facing name — WAHVA declaration. Persist type stays `ffw`. */
export const FFW_FORM_TITLE = "Fitness for Work";

export const FFW_DECLARATION_PREAMBLE =
  "By signing this form, I acknowledge all information contained in this declaration is true and correct to the best of my knowledge.";

export const FFW_HANDOFF_NOTE =
  "Your vehicle must not leave its parking area for the shift until this form has been completed, then handed to the responsible person onsite at your location, or handed to the office at the end of your trip only if you start in a remote location.";

function ffwCompanyTerms(companyName?: string | null): { company: string; management: string } {
  const name = companyName?.trim();
  return {
    company: name || "the company",
    management: name ? `${name} management` : "management",
  };
}

/** Ten WAHVA Fitness for Work points, paper order (1|2, 3|4 …). All mandatory. */
export function buildFfwSchema(companyName?: string | null): ChecklistSchemaItem[] {
  const { company, management } = ffwCompanyTerms(companyName);
  return [
    {
      code: "ffw_01",
      label: "I agree to report any fitness for work issues I may be having.",
      notes: [`I understand that any report to ${management} remains confidential.`],
    },
    {
      code: "ffw_02",
      label: "I am physically well.",
      notes: ["I do not have an illness or injury that may affect my fitness for work."],
    },
    {
      code: "ffw_03",
      label: `I have reported all prescribed medications to ${company}.`,
      notes: [
        "If you have been prescribed any medications by a doctor and require a letter to drive a heavy vehicle, you must provide a copy of the prescription and doctor's letter to " +
          management +
          ".",
        `Drivers must always keep a copy of both documents with them while driving ${company} vehicles.`,
      ],
    },
    {
      code: "ffw_04",
      label: "I am not under the influence of illicit drugs or alcohol.",
      notes: [
        `I agree to notify ${management} that I am not fit for work before my rostered shift starts if I am affected by illicit drugs or alcohol.`,
        "I agree that if I have not complied with this requirement, my employment may be terminated.",
      ],
    },
    {
      code: "ffw_05",
      label: "I agree to random Drug and Alcohol testing.",
      notes: [
        `I understand that ${company} has a drug and alcohol policy and testing program to ensure driver fitness for work remains at a high standard.`,
        "I agree that if I do not comply with a request for a sample to be tested, my employment may be terminated.",
      ],
    },
    {
      code: "ffw_06",
      label: "I have had enough quality sleep.",
      notes: [
        `If I am not fully rested, I will let ${management} know, so alternative arrangements can be made.`,
        "I understand I will not be penalized for reporting any fatigue issues before my shift starts.",
      ],
    },
    {
      code: "ffw_07",
      label: "I have not worked a second job.",
      notes: [
        `If I am working in any job outside of ${company}, I agree to report this to ${management} so any extra work I am doing can be risk assessed for my fitness for work.`,
        "I agree that if I have not complied with this requirement, my employment may be terminated.",
      ],
    },
    {
      code: "ffw_08",
      label: "I am not stressed.",
      notes: [
        "I am not under stress so it may affect my ability to perform my work safely.",
        `Please discuss any issues outside of work that may be affecting you with ${management}.`,
        `${management} may make alternative working arrangements or provide other assistance if necessary.`,
      ],
    },
    {
      code: "ffw_09",
      label: "I have enough food and water for the shift.",
      notes: [
        "I understand that having adequate food and water promotes good health and alertness during my shift.",
        "I agree to report any issues with facilities at any workplace.",
      ],
    },
    {
      code: "ffw_10",
      label: `I will report any issues outside ${company} operations that affect my fitness for work.`,
      notes: [
        `If I experience any issues outside of ${company} operations or control while working, I agree to report this to ${management} as soon as I can, so ${company} can deal with the situation.`,
      ],
    },
  ];
}

export const FFW_SCHEMA_STUB: ChecklistSchemaItem[] = buildFfwSchema();

/**
 * One Pre-departure list from WAHVA truck + van forms.
 * N/A only on items that are not on every vehicle type.
 */
export const PRESTART_SCHEMA_STUB: ChecklistSchemaGroup[] = [
  {
    code: "ext_posture",
    section: "External",
    label: "Vehicle posture",
    notes: ["Is the vehicle level, all axles level?"],
  },
  {
    code: "ext_leaks",
    section: "External",
    label: "Fluid leaks",
    notes: ["Are there any fluid leaks under the vehicle?"],
  },
  {
    code: "ext_breakdown",
    section: "External",
    label: "Breakdown equipment",
    notes: ["Jack, wheel brace, and relevant tools in place", "Breakdown triangles if carried"],
  },
  {
    code: "ext_suspension",
    section: "External",
    label: "Suspension and chassis",
    notes: ["Is there any obvious damage or wear, broken parts?"],
  },
  {
    code: "ext_tyres",
    section: "External",
    label: "Tyres and wheels",
    notes: ["Tread depth and inflation good, wheel condition good?"],
  },
  {
    code: "ext_hubs",
    section: "External",
    label: "Hubs and wheel nuts",
    notes: ["Wheel nuts in place, indicators, check for hub leaks?"],
  },
  {
    code: "ext_air_tanks",
    section: "External",
    label: "Air tanks",
    naAllowed: true,
    notes: ["All air tanks checked / drained if applicable?"],
  },
  {
    code: "ext_grabs",
    section: "External",
    label: "Grab handles and steps",
    notes: ["Are grab handles and steps secure and clean?"],
  },
  {
    code: "ext_turntable",
    section: "External",
    label: "Turntable / Ringfeder / pintle hook",
    naAllowed: true,
    notes: [
      "Turntable greased, handle secure, no cracks or damage?",
      "Ringfeder (if fitted) secure, no damage, handle free?",
      "Pintle hook no damage or cracks?",
    ],
  },
  {
    code: "ext_mudguards",
    section: "External",
    label: "Mudguards / flaps",
    notes: ["Are mud flaps and guards in good condition and secure?"],
  },
  {
    code: "ext_lights",
    section: "External",
    label: "Vehicle lighting",
    notes: ["Stop, tail, clearance, indicators, headlights, reflectors?"],
  },
  {
    code: "ext_body",
    section: "External",
    label: "Body condition",
    notes: ["Note any panel damage, loose parts, scratches, dents?"],
  },
  {
    code: "ext_mirrors",
    section: "External",
    label: "Mirrors",
    notes: ["Mirrors are secure, no damage to housing or glass?"],
  },
  {
    code: "ext_glass",
    section: "External",
    label: "Windscreen and windows",
    notes: ["All windows clean, no cracks or chips in driver's view?"],
  },
  {
    code: "ext_plates",
    section: "External",
    label: "Licence plates",
    notes: ["Licence plates in place, secure, matching set front and back?"],
  },
  {
    code: "ext_extinguisher",
    section: "External",
    label: "External fire extinguisher",
    naAllowed: true,
    notes: ["If fitted, check secure, tagged, in date, gauge in the green?"],
  },
  {
    code: "ext_curtains",
    section: "External",
    label: "Curtains, buckles, tensioners",
    naAllowed: true,
    notes: ["Curtains, straps, and buckles secure, no damage, function well?"],
  },
  {
    code: "ext_fuel_caps",
    section: "External",
    label: "Fuel / AdBlue caps",
    naAllowed: true,
    notes: ["Secure, not leaking, locked if lockable?"],
  },
  {
    code: "cab_seat",
    section: "In cab / from driver seat",
    label: "Seat and seatbelt",
    notes: [
      "Seat moves freely, all functions working",
      "Seat and belt in good condition, no holes or fraying, belt retracts correctly?",
    ],
  },
  {
    code: "cab_extinguisher",
    section: "In cab / from driver seat",
    label: "Fire extinguisher",
    notes: ["Secure, gauge in the green?"],
  },
  {
    code: "cab_firstaid",
    section: "In cab / from driver seat",
    label: "First aid kit",
    notes: ["Available and accessible in emergency?"],
  },
  {
    code: "cab_dash",
    section: "In cab / from driver seat",
    label: "Dash warning lights",
    notes: [
      "Warning lights go out, engine lights, instruments",
      "No warnings or alarms stay on after start?",
    ],
  },
  {
    code: "cab_wipers",
    section: "In cab / from driver seat",
    label: "Wipers and washers",
    notes: ["Function correctly, fluid in reservoir?"],
  },
  {
    code: "cab_horn",
    section: "In cab / from driver seat",
    label: "Horn, reverse alarms",
    notes: ["Check function, switch for reverse alarm functions?"],
  },
  {
    code: "cab_controls",
    section: "In cab / from driver seat",
    label: "Driver control functions",
    notes: ["Steering, handbrake, foot brake", "Air gauges reading full if fitted"],
  },
  {
    code: "cab_cabin",
    section: "In cab / from driver seat",
    label: "Cabin condition",
    notes: ["Clean, no loose items in footwell, demister functions?"],
  },
  {
    code: "cab_service",
    section: "In cab / from driver seat",
    label: "Service and maintenance",
    notes: ["Service sticker is in date, check date and kms when due?"],
  },
];

/**
 * Trailer Pre-departure — own form, WAHVA trailer paper order.
 * N/A only on items that do not apply to every trailer.
 */
export const TRAILER_PRESTART_SCHEMA: ChecklistSchemaGroup[] = [
  {
    code: "trl_posture",
    section: "External",
    label: "Vehicle posture",
    notes: ["Trailer is level, all axles level?"],
  },
  {
    code: "trl_air_elec",
    section: "External",
    label: "Air and electrical fittings",
    notes: ["Are air line fittings secure, electrical plug undamaged and secure?"],
  },
  {
    code: "trl_kingpin",
    section: "External",
    label: "Kingpin",
    naAllowed: true,
    notes: ["Clear of debris, undamaged, secure?"],
  },
  {
    code: "trl_legs",
    section: "External",
    label: "Legs",
    naAllowed: true,
    notes: ["Support legs straight, undamaged and operational?"],
  },
  {
    code: "trl_curtains",
    section: "External",
    label: "Curtains and straps",
    naAllowed: true,
    notes: ["Curtains and securing straps and buckles checked, in place and undamaged?"],
  },
  {
    code: "trl_restraint",
    section: "External",
    label: "Load restraint",
    naAllowed: true,
    notes: [
      "All load restraint systems in place, straps not frayed, hooks, buckles and ratchets undamaged, gates have support cables in place, undamaged?",
    ],
  },
  {
    code: "trl_suspension",
    section: "External",
    label: "Suspension and chassis",
    notes: ["Any obvious damage or wear, broken parts?"],
  },
  {
    code: "trl_rear_doors",
    section: "External",
    label: "Rear doors",
    naAllowed: true,
    notes: ["Secure, undamaged hinges or locks?"],
  },
  {
    code: "trl_tyres",
    section: "External",
    label: "Tyres and wheels",
    notes: ["Tread depth and inflation good, wheel condition good?"],
  },
  {
    code: "trl_hubs",
    section: "External",
    label: "Hubs and wheel nuts",
    notes: ["Wheel nuts in place, indicators, check for hub leaks?"],
  },
  {
    code: "trl_ringfeder",
    section: "External",
    label: "Ringfeder",
    naAllowed: true,
    notes: ["If fitted and used: Ringfeder secure, no damage, handle moves easily?"],
  },
  {
    code: "trl_mudguards",
    section: "External",
    label: "Mudguards / flaps",
    notes: ["Are mud flaps and guards in good condition and secure?"],
  },
  {
    code: "trl_body",
    section: "External",
    label: "Body condition",
    notes: ["Note any panel damage, loose parts, scratches, dents?"],
  },
  {
    code: "trl_plates",
    section: "External",
    label: "Licence plate",
    notes: ["Licence plate in place and secure?"],
  },
  {
    code: "trl_extinguisher",
    section: "External",
    label: "External fire extinguisher",
    naAllowed: true,
    notes: ["If fitted, check secure, tagged, in date, gauge in the green?"],
  },
  {
    code: "trl_lights",
    section: "External",
    label: "Trailer lighting",
    notes: ["Stop, tail, clearance, indicators, headlights, reflectors?"],
  },
  {
    code: "trl_air_brakes",
    section: "External",
    label: "Air line and brake function",
    notes: ["No air line leaks, brakes function?"],
  },
];

/**
 * Forklift Pre-departure — own form, WAHVA forklift paper order.
 * N/A only on items that do not apply to every forklift.
 */
export const FORKLIFT_PRESTART_SCHEMA: ChecklistSchemaGroup[] = [
  {
    code: "fl_tyres",
    section: "External",
    label: "Tyres",
    notes: ["Check each tyre for wear or damage, and pressure (if applicable)"],
  },
  {
    code: "fl_fluids",
    section: "External",
    label: "Fluid levels",
    naAllowed: true,
    notes: ["Check oil levels (hydraulic and engine), battery fluid, fuel and coolant levels"],
  },
  {
    code: "fl_seat",
    section: "External",
    label: "Seat and seatbelt",
    notes: ["Check the condition and adjustment and that the seat attachment point is secure"],
  },
  {
    code: "fl_warning",
    section: "External",
    label: "Warning devices",
    notes: [
      "Check horn is operational",
      "Check all other fitted devices, such as lights, reversing beeper and flashing beacon, are operational",
    ],
  },
  {
    code: "fl_capacity",
    section: "External",
    label: "Capacity",
    notes: [
      "Check that the load capacity data plate is fitted, legible and correct",
      "Confirm that the forklift has sufficient capacity and reach for the load being lifted",
    ],
  },
  {
    code: "fl_mast",
    section: "External",
    label: "Mast",
    notes: ["Check for signs of damage", "Check lift chains and guides for wear"],
  },
  {
    code: "fl_hydraulics",
    section: "External",
    label: "Hydraulic cylinders and hoses",
    notes: ["Check for any leaks, cracks, deterioration, and fray in hoses"],
  },
  {
    code: "fl_tines",
    section: "External",
    label: "Tines",
    notes: ["Check for excessive wear, damage, bends, modifications, cracks or repairs"],
  },
  {
    code: "fl_guarding",
    section: "External",
    label: "Guarding",
    notes: ["Check that all guards are in place"],
  },
  {
    code: "fl_attachments",
    section: "External",
    label: "Attachments",
    naAllowed: true,
    notes: [
      "Check any attachments for wear, damage and for correct function",
      "Attachments should be annotated on the load capacity data plate",
    ],
  },
  {
    code: "fl_controls",
    section: "Checks after starting",
    label: "Control operation",
    notes: ["Check that all pedals and controls operate correctly (including steering)"],
  },
  {
    code: "fl_brakes",
    section: "Checks after starting",
    label: "Brakes",
    notes: ["Check that the brakes (including parking brake) operate correctly"],
  },
  {
    code: "fl_extinguisher",
    section: "Checks after starting",
    label: "Fire extinguisher",
    naAllowed: true,
    notes: ["If fitted, is in date and gauge in the green"],
  },
  {
    code: "fl_dash",
    section: "Checks after starting",
    label: "Dash warning lights",
    notes: ["No warning lights stay lit after the engine has run for a short time"],
  },
  {
    code: "fl_service",
    section: "Checks after starting",
    label: "Service and maintenance",
    notes: [
      "Check for service due — hours or sticker",
      "If none, report as item found",
    ],
  },
];

export function prestartPlantConfig(plant: PrestartPlant): {
  type: "prestart" | "prestart_trailer" | "prestart_forklift";
  title: string;
  schema: ChecklistSchemaGroup[];
  noun: string;
  regoLabel: string;
  regoPlaceholder: string;
} {
  if (plant === "trailer") {
    return {
      type: "prestart_trailer",
      title: TRAILER_PRESTART_FORM_TITLE,
      schema: TRAILER_PRESTART_SCHEMA,
      noun: "trailer",
      regoLabel: "Trailer registration (required)",
      regoPlaceholder: "The trailer you inspected",
    };
  }
  if (plant === "forklift") {
    return {
      type: "prestart_forklift",
      title: FORKLIFT_PRESTART_FORM_TITLE,
      schema: FORKLIFT_PRESTART_SCHEMA,
      noun: "forklift",
      regoLabel: "Forklift registration or plant ID (required)",
      regoPlaceholder: "The forklift you inspected",
    };
  }
  return {
    type: "prestart",
    title: PRESTART_FORM_TITLE,
    schema: PRESTART_SCHEMA_STUB,
    noun: "vehicle",
    regoLabel: "Vehicle registration (required)",
    regoPlaceholder: "The truck or van you inspected",
  };
}

/** Driver-facing name — day-row load check. Persist type stays `dimension_load`. */
export const LOAD_FORM_TITLE = "Load check";

/**
 * Day-row load check (WAHVA Dimension & Loading columns).
 * N/A only on Permits and Dunnage / friction — not every load uses those.
 */
export const LOAD_SCHEMA_STUB: ChecklistSchemaItem[] = [
  {
    code: "load_permits",
    label: "Permits",
    naAllowed: true,
    notes: [
      "Notice or permit attached if this load needs one",
      "Route authorized under the notice or permit (RAV Network check)",
    ],
  },
  {
    code: "load_dimensions",
    label: "Dimensions",
    notes: ["Vehicle and load within regulated dimensions, or as allowed by the notice or permit"],
  },
  {
    code: "load_security",
    label: "Load security",
    notes: [
      "Load properly secured",
      "Restraint equipment load-rated and in good condition",
    ],
  },
  {
    code: "load_stability",
    label: "Stability / rollover risk",
    notes: ["Load positioning and centre of gravity preserve vehicle stability"],
  },
  {
    code: "load_suitability",
    label: "Vehicle suitability",
    notes: ["Vehicle and combination suitable for this load (mass, body type, ratings)"],
  },
  {
    code: "load_dunnage",
    label: "Dunnage / friction",
    naAllowed: true,
    notes: [
      "Dunnage chosen, positioned, and restrained correctly",
      "Friction adequate for this load",
    ],
  },
];

/** Driver-facing name. Persist type is `hookup`. Not a week-PDF tick. */
export const HOOKUP_FORM_TITLE = "Hook up";

export const HOOKUP_PROCEDURE_NOTE =
  "Hookup procedure — must be completed in the following order.";

export const HOOKUP_SIGN_NOTE =
  "Driver to sign this checklist for each hookup and return to your supervisor before leaving the hookup location.";

export const HOOKUP_OBSERVATIONS_LABEL = "Faults and observations";

/**
 * MTS Hookup Checklist Rev 1 June 2025 — 14 ticks, paper order.
 * A subset of hook-up training; the procedure is taught elsewhere.
 * COMPLETED / FAULT only. No N/A. Faults go in the observations box.
 * Driver sign is the signature, not a 15th item.
 */
export const HOOKUP_SCHEMA: ChecklistSchemaItem[] = [
  {
    code: "hook_01",
    label:
      "1. Checked turntable greased and jaws are open / handle is locked open. Air lines are clear of the turntable and deck.",
  },
  {
    code: "hook_02",
    label: "2. Reversed back to the trailer and stop short of.",
  },
  {
    code: "hook_03",
    label: "3. Applied handbrake and get out of truck.",
  },
  {
    code: "hook_04",
    label:
      "4. Checked the trailer alignment and turntable height before attempting to hook up. With airbags at neutral height, turntable must be at the same level as a trailer skid plate.",
  },
  {
    code: "hook_05",
    label: "5. Lowered the airbags (or raise trailer legs).",
  },
  {
    code: "hook_06",
    label: "6. Reversed under the trailer and stopped short of the kingpin.",
  },
  {
    code: "hook_07",
    label:
      "7. Raised airbags / wind up trailer legs to remove any gap between the turntable and the trailer.",
  },
  {
    code: "hook_08",
    label: "8. Applied handbrake and get out of truck.",
  },
  {
    code: "hook_09",
    label: "9. CRITICAL - Checked there is no gap between the turntable and the trailer.",
  },
  {
    code: "hook_10",
    label: "10. Reversed back under the trailer until locked then complete first tug test.",
  },
  {
    code: "hook_11",
    label: "11. Applied handbrake and get out of truck.",
  },
  {
    code: "hook_12",
    label:
      "12. CRITICAL - Checked there is no gap between the turntable and the trailer, handle and jaws are locked closed.",
  },
  {
    code: "hook_13",
    label:
      "13. Raised the trailer legs, stowed the leg handle, connected the leads and air lines.",
  },
  {
    code: "hook_14",
    label: "14. I have completed a second tug test.",
  },
];
