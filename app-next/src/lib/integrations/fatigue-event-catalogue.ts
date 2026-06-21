/**
 * Fatigue-focused vendor alarm catalogue (Autonomise / VT3600-AI / Streamax path).
 *
 * Circadia is not a fleet-management platform — exclude seatbelt, smoking, journey,
 * geofence, etc. Keep vendor alarm IDs verbatim for mapper compatibility.
 *
 * @see docs/architecture/incident-routing-assembly.md §5d
 */

export type FatigueEventTier = "core" | "fatigue_adjacent" | "safety_other" | "excluded";

export type VendorAlarmFamily = "DSM" | "ADAS" | "EMERGENCY";

/** Which Circadia pipeline accepts this alarm when enabled for the tenant. */
export type FatigueEventPipeline = "incident" | "incident_and_assurance";

export type FatigueEventCatalogueEntry = {
  /** Stable vendor alarm id, e.g. VT3600AI_ALARM_DSM_Fatigue */
  vendorAlarmId: string;
  displayName: string;
  family: VendorAlarmFamily;
  /** Vendor Events Platform classification when known. */
  vendorClassification: "red" | "amber" | null;
  tier: FatigueEventTier;
  defaultEnabled: boolean;
  pipeline: FatigueEventPipeline | null;
};

/** Autonomise device-alarm ids observed on VT3600-AI (Miocevich / Geobox tenant). */
export const AUTONOMISE_VT3600AI_CATALOGUE: readonly FatigueEventCatalogueEntry[] = [
  {
    vendorAlarmId: "VT3600AI_ALARM_DSM_Fatigue",
    displayName: "Fatigue",
    family: "DSM",
    vendorClassification: "red",
    tier: "core",
    defaultEnabled: true,
    pipeline: "incident",
  },
  {
    vendorAlarmId: "VT3600AI_ALARM_DSM_Distracted",
    displayName: "Distraction",
    family: "DSM",
    vendorClassification: "amber",
    tier: "core",
    defaultEnabled: true,
    pipeline: "incident_and_assurance",
  },
  {
    vendorAlarmId: "VT3600AI_ALARM_ADAS_LaneDeparture",
    displayName: "Lane Departure",
    family: "ADAS",
    vendorClassification: "amber",
    tier: "fatigue_adjacent",
    defaultEnabled: true,
    pipeline: "incident",
  },
  {
    vendorAlarmId: "VT3600AI_ALARM_ADAS_FollowingDistanceWarning",
    displayName: "Following Distance Warning",
    family: "ADAS",
    vendorClassification: "amber",
    tier: "fatigue_adjacent",
    defaultEnabled: true,
    pipeline: "incident",
  },
  {
    vendorAlarmId: "VT3600AI_ALARM_ADAS_ForwardCollisionWarning",
    displayName: "Forward Collision Warning",
    family: "ADAS",
    vendorClassification: "amber",
    tier: "fatigue_adjacent",
    defaultEnabled: true,
    pipeline: "incident",
  },
  {
    vendorAlarmId: "VT3600AI_ALARM_DSM_Phonecall",
    displayName: "Mobile Phone Warning",
    family: "DSM",
    vendorClassification: "amber",
    tier: "fatigue_adjacent",
    defaultEnabled: false,
    pipeline: "incident",
  },
  {
    vendorAlarmId: "VT3600AI_ALARM_ADAS_PedestrianCollision",
    displayName: "Pedestrian Collision",
    family: "ADAS",
    vendorClassification: "red",
    tier: "safety_other",
    defaultEnabled: false,
    pipeline: "incident",
  },
  {
    vendorAlarmId: "VT3600AI_ALARM_DSM_NoDriver",
    displayName: "No Driver",
    family: "DSM",
    vendorClassification: "amber",
    tier: "safety_other",
    defaultEnabled: false,
    pipeline: "incident",
  },
  {
    vendorAlarmId: "VT3600AI_ALARM_EMERGENCY",
    displayName: "Panic",
    family: "EMERGENCY",
    vendorClassification: "red",
    tier: "safety_other",
    defaultEnabled: false,
    pipeline: "incident",
  },
  {
    vendorAlarmId: "VT3600AI_ALARM_ADAS_OverspeedPreAlarm",
    displayName: "Overspeed Pre-Alarm",
    family: "ADAS",
    vendorClassification: "amber",
    tier: "excluded",
    defaultEnabled: false,
    pipeline: null,
  },
  {
    vendorAlarmId: "VT3600AI_ALARM_DSM_SeatbeltUnfastened",
    displayName: "Seatbelt Unfastened",
    family: "DSM",
    vendorClassification: "amber",
    tier: "excluded",
    defaultEnabled: false,
    pipeline: null,
  },
  {
    vendorAlarmId: "VT3600AI_ALARM_DSM_Smoking",
    displayName: "Smoking",
    family: "DSM",
    vendorClassification: "amber",
    tier: "excluded",
    defaultEnabled: false,
    pipeline: null,
  },
  {
    vendorAlarmId: "VT3600AI_ALARM_ADAS_LicensePlateRecognition",
    displayName: "License Plate Recognition",
    family: "ADAS",
    vendorClassification: "amber",
    tier: "excluded",
    defaultEnabled: false,
    pipeline: null,
  },
] as const;

export type FatigueEventPresetId = "core_only" | "core_plus_adas" | "custom";

export const FATIGUE_EVENT_PRESET_LABELS: Record<FatigueEventPresetId, string> = {
  core_only: "Fatigue core only (DSM fatigue + distraction)",
  core_plus_adas: "Core + ADAS fatigue proxies (recommended default)",
  custom: "Custom per-alarm selection",
};

const CATALOGUE_BY_ID = new Map(
  AUTONOMISE_VT3600AI_CATALOGUE.map((e) => [e.vendorAlarmId, e] as const)
);

export function getCatalogueEntry(vendorAlarmId: string): FatigueEventCatalogueEntry | undefined {
  return CATALOGUE_BY_ID.get(vendorAlarmId);
}

export function catalogueEntriesForTier(
  tier: FatigueEventTier
): FatigueEventCatalogueEntry[] {
  return AUTONOMISE_VT3600AI_CATALOGUE.filter((e) => e.tier === tier);
}

export function catalogueEntriesOfferedToTenant(): FatigueEventCatalogueEntry[] {
  return AUTONOMISE_VT3600AI_CATALOGUE.filter((e) => e.tier !== "excluded");
}

/** Default enabled alarm ids for owner-admin onboarding presets. */
export function defaultEnabledAlarmIds(preset: FatigueEventPresetId): string[] {
  if (preset === "core_only") {
    return AUTONOMISE_VT3600AI_CATALOGUE.filter((e) => e.tier === "core").map((e) => e.vendorAlarmId);
  }
  if (preset === "core_plus_adas") {
    return AUTONOMISE_VT3600AI_CATALOGUE.filter(
      (e) => e.tier === "core" || e.tier === "fatigue_adjacent"
    )
      .filter((e) => e.defaultEnabled)
      .map((e) => e.vendorAlarmId);
  }
  return [];
}

/** Ingest gate: tenant-enabled ids must be offered (non-excluded) and explicitly enabled. */
export function isVendorAlarmAccepted(
  vendorAlarmId: string,
  enabledAlarmIds: ReadonlySet<string>
): boolean {
  const entry = getCatalogueEntry(vendorAlarmId);
  if (!entry || entry.tier === "excluded" || entry.pipeline === null) return false;
  return enabledAlarmIds.has(vendorAlarmId);
}
