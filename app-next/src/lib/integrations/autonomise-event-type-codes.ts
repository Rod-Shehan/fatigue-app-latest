/**
 * Autonomise `eventTypes` numeric codes → VT3600 alarm ids.
 *
 * Source: VisionTrack.Domain.Enums.EventType in Autonomise swagger
 * (`GET https://api.autonomise.ai/swagger/v2/swagger.json`).
 *
 * Important: code **2 = Speed**, **18 = Fatigue**. Do not map 2 to fatigue.
 */

/** Default code → vendor alarm id (catalogue ids). */
export const AUTONOMISE_DEFAULT_EVENT_TYPE_TO_ALARM: Readonly<Record<number, string>> = {
  7: "VT3600AI_ALARM_EMERGENCY",
  18: "VT3600AI_ALARM_DSM_Fatigue",
  19: "VT3600AI_ALARM_DSM_Smoking",
  20: "VT3600AI_ALARM_DSM_Distracted",
  21: "VT3600AI_ALARM_DSM_NoDriver",
  22: "VT3600AI_ALARM_ADAS_LaneDeparture",
  23: "VT3600AI_ALARM_ADAS_ForwardCollisionWarning",
  27: "VT3600AI_ALARM_DSM_Phonecall",
  28: "VT3600AI_ALARM_ADAS_FollowingDistanceWarning",
  29: "VT3600AI_ALARM_DSM_SeatbeltUnfastened",
  30: "VT3600AI_ALARM_ADAS_PedestrianCollision",
  48: "VT3600AI_ALARM_DSM_Fatigue",
  50: "VT3600AI_ALARM_DSM_Fatigue",
};

function parseCodeList(raw: string | undefined, fallback: number[]): number[] {
  if (!raw?.trim()) return fallback;
  return raw
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

function parseEnvCodeMap(raw: string | undefined): Record<number, string> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<number, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const code = Number.parseInt(key, 10);
      if (!Number.isFinite(code)) continue;
      if (typeof value !== "string" || !value.trim()) continue;
      out[code] = value.trim();
    }
    return out;
  } catch {
    return {};
  }
}

/** Merged map: defaults + fatigue env aliases + optional JSON overrides. */
export function getAutonomiseEventTypeCodeMap(): Readonly<Record<number, string>> {
  const merged: Record<number, string> = { ...AUTONOMISE_DEFAULT_EVENT_TYPE_TO_ALARM };

  const fatigueCodes = parseCodeList(process.env.AUTONOMISE_FATIGUE_EVENT_TYPE_CODES, [18, 48, 50]);
  for (const code of fatigueCodes) {
    merged[code] = "VT3600AI_ALARM_DSM_Fatigue";
  }

  const overrides = parseEnvCodeMap(process.env.AUTONOMISE_EVENT_TYPE_CODE_MAP);
  Object.assign(merged, overrides);

  return merged;
}

/** Resolve the first matching vendor alarm id from Autonomise numeric event type codes. */
export function resolveVendorAlarmFromEventTypeCodes(codes: readonly number[]): string | null {
  const map = getAutonomiseEventTypeCodeMap();
  for (const code of codes) {
    const hit = map[code];
    if (hit) return hit;
  }
  return null;
}

/** @deprecated Prefer `getAutonomiseEventTypeCodeMap` — kept for env docs compatibility. */
export function getAutonomiseFatigueEventTypeCodesFromEnv(): number[] {
  return parseCodeList(process.env.AUTONOMISE_FATIGUE_EVENT_TYPE_CODES, [18, 48, 50]);
}
