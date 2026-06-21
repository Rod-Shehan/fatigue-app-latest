/**
 * Defensive field extraction from Autonomise Event / Media webhook JSON.
 * Refine once MTS pilot payloads are captured.
 */

const VENDOR_ALARM_ID_PATTERN = /VT3600AI_ALARM_[A-Za-z0-9_]+/;

const ALARM_FIELD_KEYS = [
  "alarmId",
  "alarm_id",
  "AlarmId",
  "deviceAlarmId",
  "device_alarm_id",
  "eventTypeId",
  "event_type_id",
  "EventTypeId",
] as const;

const EVENT_ID_KEYS = [
  "eventId",
  "event_id",
  "EventId",
  "id",
  "Id",
] as const;

const VRN_KEYS = [
  "vehicleRegistration",
  "vehicle_registration",
  "VehicleRegistration",
  "vrn",
  "VRN",
  "registration",
  "rego",
  "vehicleRego",
] as const;

const DRIVER_KEYS = ["driverName", "driver_name", "DriverName", "driver"] as const;

const MEDIA_URL_KEYS = [
  "mediaUrl",
  "media_url",
  "videoUrl",
  "video_url",
  "clipUrl",
  "clip_url",
  "url",
  "playbackUrl",
  "playback_url",
] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function stringField(obj: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function scanForAlarmId(value: unknown, depth = 0): string | null {
  if (depth > 8) return null;
  if (typeof value === "string") {
    const m = value.match(VENDOR_ALARM_ID_PATTERN);
    return m ? m[0] : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = scanForAlarmId(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const key of ALARM_FIELD_KEYS) {
    const direct = value[key];
    if (typeof direct === "string" && direct.trim()) {
      if (VENDOR_ALARM_ID_PATTERN.test(direct)) return direct.trim();
      return direct.trim();
    }
  }
  for (const v of Object.values(value)) {
    const found = scanForAlarmId(v, depth + 1);
    if (found) return found;
  }
  return null;
}

export type AutonomiseExtractedFields = {
  vendorAlarmId: string | null;
  vendorEventId: string | null;
  vehicleRego: string | null;
  driverName: string | null;
  mediaUrl: string | null;
  linkedEventId: string | null;
};

export function extractAutonomiseFields(payload: unknown): AutonomiseExtractedFields {
  const root = isRecord(payload) ? payload : {};
  const vendorAlarmId = scanForAlarmId(payload);
  const vendorEventId = stringField(root, EVENT_ID_KEYS);
  const vehicleRego = stringField(root, VRN_KEYS) ?? findNestedString(root, VRN_KEYS);
  const driverName = stringField(root, DRIVER_KEYS) ?? findNestedString(root, DRIVER_KEYS);
  const mediaUrl = stringField(root, MEDIA_URL_KEYS) ?? findNestedString(root, MEDIA_URL_KEYS);
  const linkedEventId =
    stringField(root, ["linkedEventId", "linked_event_id", "parentEventId", "ParentEventId"]) ??
    findNestedString(root, ["linkedEventId", "linked_event_id", "parentEventId"]) ??
    vendorEventId;

  return {
    vendorAlarmId,
    vendorEventId,
    vehicleRego,
    driverName,
    mediaUrl,
    linkedEventId,
  };
}

function findNestedString(root: Record<string, unknown>, keys: readonly string[]): string | null {
  const stack: unknown[] = [root];
  let depth = 0;
  while (stack.length > 0 && depth < 8) {
    const n = stack.length;
    for (let i = 0; i < n; i++) {
      const cur = stack.shift();
      if (!isRecord(cur)) continue;
      const hit = stringField(cur, keys);
      if (hit) return hit;
      for (const v of Object.values(cur)) {
        if (isRecord(v)) stack.push(v);
      }
    }
    depth++;
  }
  return null;
}

/** Stable dedupe key for ingest row when vendor sends an event/media id. */
export function buildAutonomiseIdempotencyKey(
  kind: "event" | "media",
  fields: AutonomiseExtractedFields,
  payload: unknown
): string | null {
  if (kind === "event" && fields.vendorEventId) {
    return `event:${fields.vendorEventId}`;
  }
  if (kind === "media") {
    if (fields.vendorEventId) return `media:event:${fields.vendorEventId}`;
    if (fields.linkedEventId) return `media:linked:${fields.linkedEventId}`;
    if (fields.mediaUrl) return `media:url:${fields.mediaUrl}`;
  }
  if (isRecord(payload) && typeof payload.idempotencyKey === "string" && payload.idempotencyKey.trim()) {
    return `${kind}:${payload.idempotencyKey.trim()}`;
  }
  return null;
}
