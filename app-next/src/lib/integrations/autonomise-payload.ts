/**
 * Defensive field extraction from Autonomise Event / Media webhook JSON.
 * Handles VT3600 alarm ids, FNOL base64 ids, and numeric eventTypes (live MTS pilot).
 */

export type AutonomiseWebhookKind = "event" | "media";

const VENDOR_ALARM_ID_PATTERN = /VT3600AI_ALARM_[A-Za-z0-9_]+/;

/** Autonomise `eventTypes` codes observed on MTS fatigue events (code 2 = fatigue). */
const AUTONOMISE_EVENT_TYPE_CODE_TO_ALARM: Readonly<Record<number, string>> = {
  2: "VT3600AI_ALARM_DSM_Fatigue",
};

const EVENT_LABEL_TO_ALARM: Readonly<Record<string, string>> = {
  fatigue: "VT3600AI_ALARM_DSM_Fatigue",
  distracted: "VT3600AI_ALARM_DSM_Distracted",
  distraction: "VT3600AI_ALARM_DSM_Distracted",
  "lane departure": "VT3600AI_ALARM_ADAS_LaneDeparture",
  "following distance warning": "VT3600AI_ALARM_ADAS_FollowingDistanceWarning",
  "forward collision warning": "VT3600AI_ALARM_ADAS_ForwardCollisionWarning",
  "mobile phone warning": "VT3600AI_ALARM_DSM_Phonecall",
  phonecall: "VT3600AI_ALARM_DSM_Phonecall",
  "phone call": "VT3600AI_ALARM_DSM_Phonecall",
  "pedestrian collision": "VT3600AI_ALARM_ADAS_PedestrianCollision",
  "no driver": "VT3600AI_ALARM_DSM_NoDriver",
  panic: "VT3600AI_ALARM_EMERGENCY",
};

const ALARM_FIELD_KEYS = [
  "alarmId",
  "alarm_id",
  "AlarmId",
  "deviceAlarmId",
  "device_alarm_id",
  "eventTypeId",
  "event_type_id",
  "EventTypeId",
  "alarmName",
  "alarm_name",
  "deviceAlarm",
  "deviceAlarmName",
] as const;

const EVENT_TYPE_LABEL_KEYS = [
  "type",
  "eventType",
  "event_type",
  "EventType",
  "name",
  "eventTypeName",
  "event_type_name",
  "alarmType",
  "alarm_type",
  "subtype",
  "subType",
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

const DRIVER_KEYS = [
  "driverName",
  "driver_name",
  "DriverName",
  "driver",
  "name",
  "fullName",
  "full_name",
  "displayName",
] as const;

const MEDIA_URL_KEYS = [
  "mediaUrl",
  "media_url",
  "videoUrl",
  "video_url",
  "clipUrl",
  "clip_url",
  "playbackUrl",
  "playback_url",
  "driverCameraUrl",
  "driver_camera_url",
  "roadCameraUrl",
  "road_camera_url",
  "eventVideoUrl",
  "event_video_url",
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

function pickNested(obj: Record<string, unknown>, path: string): string | null {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (!isRecord(cur) || !(part in cur)) return null;
    cur = cur[part];
  }
  if (typeof cur === "string" && cur.trim()) return cur.trim();
  if (typeof cur === "number" && Number.isFinite(cur)) return String(cur);
  return null;
}

/** Autonomise FNOL ids: base64 of `{orgId}|{eventUuid}`. */
export function parseFnolReference(id: string | null | undefined): {
  fnolSlug: string;
  eventUuid: string;
  canonicalEventId: string;
} {
  const raw = String(id ?? "").trim();
  if (!raw) return { fnolSlug: "", eventUuid: "", canonicalEventId: "" };

  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    if (decoded.includes("|")) {
      const [, eventUuid] = decoded.split("|").map((s) => s.trim());
      return {
        fnolSlug: raw,
        eventUuid: eventUuid || raw,
        canonicalEventId: eventUuid || raw,
      };
    }
  } catch {
    /* not base64 fnol */
  }

  return { fnolSlug: "", eventUuid: raw, canonicalEventId: raw };
}

function unwrapAutonomiseBody(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) return {};
  const nested = payload.payload ?? payload.data ?? payload.event;
  if (isRecord(nested)) {
    return { ...payload, ...nested };
  }
  return payload;
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
    }
  }
  for (const v of Object.values(value)) {
    const found = scanForAlarmId(v, depth + 1);
    if (found) return found;
  }
  return null;
}

function parseCodeList(raw: unknown): number[] {
  if (raw == null) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((v) => (typeof v === "number" ? v : Number.parseInt(String(v), 10)))
    .filter((n) => Number.isFinite(n));
}

function resolveAlarmIdFromLabels(body: Record<string, unknown>): string | null {
  for (const key of EVENT_TYPE_LABEL_KEYS) {
    const raw = body[key];
    if (typeof raw !== "string" || !raw.trim()) continue;
    const normalized = raw.trim().toLowerCase();
    const hit = EVENT_LABEL_TO_ALARM[normalized];
    if (hit) return hit;
  }
  return null;
}

function resolveAlarmIdFromEventTypes(body: Record<string, unknown>): string | null {
  const codes = parseCodeList(body.eventTypes ?? body.event_types ?? body.eventTypeIds);
  for (const code of codes) {
    const hit = AUTONOMISE_EVENT_TYPE_CODE_TO_ALARM[code];
    if (hit) return hit;
  }
  return null;
}

function resolveVendorAlarmId(body: Record<string, unknown>, payload: unknown): string | null {
  return (
    scanForAlarmId(payload) ??
    resolveAlarmIdFromEventTypes(body) ??
    resolveAlarmIdFromLabels(body)
  );
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

function resolveVehicleRego(body: Record<string, unknown>): string | null {
  return (
    pickNested(body, "vehicle.registration") ??
    pickNested(body, "vehicle.vrn") ??
    pickNested(body, "vehicle.rego") ??
    stringField(body, VRN_KEYS) ??
    findNestedString(body, VRN_KEYS)
  );
}

function resolveDriverName(body: Record<string, unknown>): string | null {
  return (
    pickNested(body, "driver.name") ??
    pickNested(body, "driver.fullName") ??
    pickNested(body, "assignedDriver.name") ??
    stringField(body, DRIVER_KEYS) ??
    findNestedString(body, DRIVER_KEYS)
  );
}

function resolveMediaUrl(body: Record<string, unknown>, payload: unknown): string | null {
  return (
    pickNested(body, "media.driverCameraUrl") ??
    pickNested(body, "media.roadCameraUrl") ??
    pickNested(body, "media.eventVideo") ??
    pickNested(body, "media.video") ??
    stringField(body, MEDIA_URL_KEYS) ??
    findNestedString(body, MEDIA_URL_KEYS) ??
    findNestedString(isRecord(payload) ? payload : body, MEDIA_URL_KEYS)
  );
}

function resolveNestedEventUuid(payload: Record<string, unknown>): string | null {
  const nested = payload.event;
  if (!isRecord(nested)) return null;
  return stringField(nested, ["id", "eventId", "event_id"]);
}

export type AutonomiseExtractedFields = {
  vendorAlarmId: string | null;
  /** Canonical fleet event id (UUID when Autonomise sends FNOL / nested event.id). */
  vendorEventId: string | null;
  /** Media webhook row id — distinct from vendorEventId on media POSTs. */
  mediaRecordId: string | null;
  vehicleRego: string | null;
  driverName: string | null;
  mediaUrl: string | null;
  linkedEventId: string | null;
};

export function extractAutonomiseFields(
  payload: unknown,
  kind: AutonomiseWebhookKind = "event"
): AutonomiseExtractedFields {
  const root = isRecord(payload) ? payload : {};
  const body = unwrapAutonomiseBody(payload);
  const vendorAlarmId = resolveVendorAlarmId(body, payload);

  const nestedEventUuid = resolveNestedEventUuid(root);
  const rootId =
    stringField(body, ["eventId", "event_id", "EventId", "guid", "reference", "fnolId", "fnol_id"]) ??
    stringField(root, ["eventId", "event_id", "EventId", "guid", "reference", "fnolId", "fnol_id"]);

  let vendorEventId: string | null = null;
  let mediaRecordId: string | null = null;

  if (kind === "media") {
    mediaRecordId = stringField(root, ["id", "Id"]) ?? null;
    if (nestedEventUuid) {
      vendorEventId = parseFnolReference(nestedEventUuid).canonicalEventId;
    } else if (rootId) {
      vendorEventId = parseFnolReference(rootId).canonicalEventId;
    }
  } else {
    const rawEventId = rootId ?? stringField(root, ["id", "Id"]);
    vendorEventId = rawEventId ? parseFnolReference(rawEventId).canonicalEventId : null;
  }

  const vehicleRego = resolveVehicleRego(body);
  const driverName = resolveDriverName(body);
  const mediaUrl = resolveMediaUrl(body, payload);
  const linkedEventId =
    stringField(body, ["linkedEventId", "linked_event_id", "parentEventId", "ParentEventId"]) ??
    vendorEventId;

  return {
    vendorAlarmId,
    vendorEventId,
    mediaRecordId,
    vehicleRego,
    driverName,
    mediaUrl,
    linkedEventId,
  };
}

/** Stable dedupe key for ingest row when vendor sends an event/media id. */
export function buildAutonomiseIdempotencyKey(
  kind: AutonomiseWebhookKind,
  fields: AutonomiseExtractedFields,
  payload: unknown
): string | null {
  if (kind === "event" && fields.vendorEventId) {
    return `event:${fields.vendorEventId}`;
  }
  if (kind === "media") {
    if (fields.mediaRecordId) return `media:${fields.mediaRecordId}`;
    if (fields.linkedEventId) return `media:linked:${fields.linkedEventId}`;
    if (fields.mediaUrl) return `media:url:${fields.mediaUrl}`;
  }
  if (isRecord(payload) && typeof payload.idempotencyKey === "string" && payload.idempotencyKey.trim()) {
    return `${kind}:${payload.idempotencyKey.trim()}`;
  }
  return null;
}
