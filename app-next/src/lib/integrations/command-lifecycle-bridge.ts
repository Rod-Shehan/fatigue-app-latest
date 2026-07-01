/**
 * Promote accepted Autonomise event webhooks into edge_fatigue_events so Command
 * triage (SSE + lifecycle trigger 003) receives the same incidents as manager Live alerts.
 */

import { createHash } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { evaluateAutonomiseEventAcceptance } from "@/lib/integrations/autonomise-event-evaluation";
import { getEnabledAlarmIdSet } from "@/lib/integrations/camera-alert-event-settings";
import {
  commandPilotTenantIdUuid,
  isCommandLifecycleBridgeEnabled,
} from "@/lib/integrations/command-lifecycle-bridge-config";
import { extractAutonomiseFields } from "@/lib/integrations/autonomise-payload";
import { getCatalogueEntry } from "@/lib/integrations/fatigue-event-catalogue";
import {
  resolveReviewMediaUrl,
  shouldReplaceReviewClip,
} from "@/lib/integrations/autonomise-media-extract";

/** Stored on edge_fatigue_events when Autonomise omits VRN — triage queue still works. */
export const TRIAGE_QUEUE_PLACEHOLDER_REGO = "UNKNOWN";

export function resolveVehicleRegistrationForQueue(
  vehicleRego: string | null | undefined
): string {
  const trimmed = vehicleRego?.trim().toUpperCase();
  return trimmed || TRIAGE_QUEUE_PLACEHOLDER_REGO;
}

export type CommandLifecycleBridgeResult = {
  promoted: boolean;
  skippedReason?: string;
  eventId?: string;
  lifecycleId?: string;
  mediaUpdated?: boolean;
};

function parseTriggerTime(payload: unknown): Date {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return new Date();
  }
  const raw = (payload as Record<string, unknown>).triggerTime;
  if (typeof raw === "string" && raw.trim()) {
    const ms = Date.parse(raw);
    if (Number.isFinite(ms)) return new Date(ms);
  }
  return new Date();
}

export function fatigueMetricTypeFromVendorAlarm(vendorAlarmId: string | null): string {
  const entry = vendorAlarmId ? getCatalogueEntry(vendorAlarmId) : undefined;
  if (entry) return entry.displayName.toUpperCase().replace(/\s+/g, "_");
  return "UNKNOWN";
}

export function confidenceScoreFromVendorAlarm(vendorAlarmId: string | null): number {
  const entry = vendorAlarmId ? getCatalogueEntry(vendorAlarmId) : undefined;
  if (entry?.vendorClassification === "red") return 0.9;
  if (entry?.vendorClassification === "amber") return 0.75;
  return 0.85;
}

export function deterministicDriverUuid(
  tenantIdUuid: string,
  driverName: string | null,
  vehicleRego: string | null
): string {
  const key = `${tenantIdUuid}:${(driverName ?? "").trim().toLowerCase()}:${(vehicleRego ?? "").trim().toUpperCase()}`;
  const hash = createHash("sha256").update(key).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function placeholderVideoUrl(ingestId: string): string {
  return `pending://autonomise/${ingestId}`;
}

function resolveCommandClip(args: PromoteArgs): string | null {
  return resolveReviewMediaUrl(args.payload, args.vendorAlarmId, args.mediaUrl);
}

type PromoteArgs = {
  ingestId: string;
  vendorAlarmId: string | null;
  vehicleRego: string | null;
  driverName: string | null;
  mediaUrl: string | null;
  payload: unknown;
};

function normalizePromoteArgs(args: PromoteArgs): PromoteArgs {
  const fields = extractAutonomiseFields(args.payload, "event");
  return {
    ...args,
    vendorAlarmId: fields.vendorAlarmId ?? args.vendorAlarmId,
    vehicleRego: fields.vehicleRego ?? args.vehicleRego,
    driverName: fields.driverName ?? args.driverName,
  };
}

/** Re-promote or refresh media on an existing event ingest row (idempotent). */
export async function syncCommandLifecycleFromEventIngest(
  prisma: PrismaClient,
  ingestId: string
): Promise<CommandLifecycleBridgeResult> {
  const latest = await prisma.autonomiseWebhookIngest.findUnique({
    where: { id: ingestId },
    select: {
      id: true,
      kind: true,
      accepted: true,
      vendorAlarmId: true,
      vehicleRego: true,
      driverName: true,
      mediaUrl: true,
      payload: true,
    },
  });
  if (!latest || latest.kind !== "event" || !latest.accepted) {
    return { promoted: false, skippedReason: "no_accepted_event_ingest" };
  }
  return maybePromoteAutonomiseToCommandLifecycle(prisma, {
    ingestId: latest.id,
    vendorAlarmId: latest.vendorAlarmId,
    vehicleRego: latest.vehicleRego,
    driverName: latest.driverName,
    mediaUrl: latest.mediaUrl,
    payload: latest.payload,
  });
}

/** Sync Command lifecycle clip after media lands on a vendor event id. */
export async function syncCommandLifecycleForVendorEventId(
  prisma: PrismaClient,
  vendorEventId: string
): Promise<CommandLifecycleBridgeResult> {
  const eventId = vendorEventId.trim();
  if (!eventId) return { promoted: false, skippedReason: "missing_event_id" };

  const eventRow = await prisma.autonomiseWebhookIngest.findFirst({
    where: {
      kind: "event",
      accepted: true,
      OR: [{ vendorEventId: eventId }, { linkedEventId: eventId }],
    },
    orderBy: { receivedAt: "desc" },
    select: { id: true },
  });
  if (!eventRow) return { promoted: false, skippedReason: "no_event_ingest" };
  return syncCommandLifecycleFromEventIngest(prisma, eventRow.id);
}

/** Promote accepted ingest rows not yet on the shared triage queue (e.g. pre-rego-fix backlog). */
export async function countUnpromotedAcceptedIngest(prisma: PrismaClient): Promise<number> {
  if (!isCommandLifecycleBridgeEnabled()) return 0;
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM "AutonomiseWebhookIngest" i
    WHERE i.kind = 'event'
      AND i.accepted = true
      AND NOT EXISTS (
        SELECT 1
        FROM edge_fatigue_events e
        WHERE e.source_ingest_id = i.id
      )
  `;
  return rows[0]?.count ?? 0;
}

/** Cap per inbox refresh — avoid scanning hundreds of rows on every poll. */
export const PROMOTE_BACKLOG_PER_INBOX_REQUEST = 15;

/** Promote accepted ingest rows not yet on the shared triage queue (e.g. pre-rego-fix backlog). */
export async function promoteAcceptedIngestBacklog(
  prisma: PrismaClient,
  args: { limit?: number } = {}
): Promise<{ promoted: number; skipped: number }> {
  if (!isCommandLifecycleBridgeEnabled()) {
    return { promoted: 0, skipped: 0 };
  }

  const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      vendorAlarmId: string | null;
      vehicleRego: string | null;
      driverName: string | null;
      mediaUrl: string | null;
      payload: unknown;
    }>
  >`
    SELECT
      i.id,
      i."vendorAlarmId",
      i."vehicleRego",
      i."driverName",
      i."mediaUrl",
      i.payload
    FROM "AutonomiseWebhookIngest" i
    WHERE i.kind = 'event'
      AND i.accepted = true
      AND NOT EXISTS (
        SELECT 1
        FROM edge_fatigue_events e
        WHERE e.source_ingest_id = i.id
      )
    ORDER BY i."receivedAt" DESC
    LIMIT ${limit}
  `;

  let promoted = 0;
  let skipped = 0;
  for (const row of rows) {
    const result = await maybePromoteAutonomiseToCommandLifecycle(prisma, {
      ingestId: row.id,
      vendorAlarmId: row.vendorAlarmId,
      vehicleRego: row.vehicleRego,
      driverName: row.driverName,
      mediaUrl: row.mediaUrl,
      payload: row.payload,
    });
    if (result.promoted) promoted += 1;
    else skipped += 1;
  }
  return { promoted, skipped };
}

export async function maybePromoteAutonomiseToCommandLifecycle(
  prisma: PrismaClient,
  args: PromoteArgs
): Promise<CommandLifecycleBridgeResult> {
  if (!isCommandLifecycleBridgeEnabled()) {
    return { promoted: false, skippedReason: "bridge_disabled" };
  }

  args = normalizePromoteArgs(args);

  const tenantIdUuid = commandPilotTenantIdUuid();
  if (!tenantIdUuid) {
    return { promoted: false, skippedReason: "missing_tenant_uuid" };
  }

  const enabledAlarmIds = await getEnabledAlarmIdSet(prisma);
  const { accepted, rejectReason } = evaluateAutonomiseEventAcceptance(
    args.vendorAlarmId,
    enabledAlarmIds
  );
  if (!accepted) {
    return { promoted: false, skippedReason: rejectReason ?? "not_accepted" };
  }

  const rego = resolveVehicleRegistrationForQueue(args.vehicleRego);

  const managerTriage = await prisma.cameraAlertTriage.findUnique({
    where: { ingestEventId: args.ingestId },
    select: { decision: true },
  });
  if (managerTriage) {
    return { promoted: false, skippedReason: "manager_already_triaged" };
  }

  const existing = await prisma.$queryRaw<Array<{ event_id: string; video_snippet_url: string }>>`
    SELECT event_id, video_snippet_url
    FROM edge_fatigue_events
    WHERE source_ingest_id = ${args.ingestId}
    LIMIT 1
  `;

  if (existing.length > 0) {
    const row = existing[0]!;
    const clip = resolveCommandClip(args);
    const needsMedia =
      clip &&
      shouldReplaceReviewClip(row.video_snippet_url, clip, args.payload, args.vendorAlarmId);

    if (needsMedia) {
      await prisma.$executeRaw`
        UPDATE edge_fatigue_events
        SET video_snippet_url = ${clip}
        WHERE event_id = ${row.event_id}::uuid
      `;
      return { promoted: false, skippedReason: "already_promoted", mediaUpdated: true, eventId: row.event_id };
    }

    return { promoted: false, skippedReason: "already_promoted", eventId: row.event_id };
  }

  const hardwareTimestamp = parseTriggerTime(args.payload);
  const driverIdUuid = deterministicDriverUuid(tenantIdUuid, args.driverName, rego);
  const videoUrl = resolveCommandClip(args) || placeholderVideoUrl(args.ingestId);

  const inserted = await prisma.$queryRaw<Array<{ event_id: string; lifecycle_id: string | null }>>`
    INSERT INTO edge_fatigue_events (
      tenant_id_uuid,
      driver_id_uuid,
      vehicle_registration,
      hardware_timestamp,
      speed_kmh,
      heading_degrees,
      lane_deviation_index,
      braking_pressure_psi,
      ai_model_version,
      fatigue_metric_type,
      confidence_score,
      video_snippet_url,
      source_ingest_id
    ) VALUES (
      ${tenantIdUuid}::uuid,
      ${driverIdUuid}::uuid,
      ${rego},
      ${hardwareTimestamp},
      0,
      0,
      0,
      0,
      'autonomise-vt3600ai',
      ${fatigueMetricTypeFromVendorAlarm(args.vendorAlarmId)},
      ${confidenceScoreFromVendorAlarm(args.vendorAlarmId)},
      ${videoUrl},
      ${args.ingestId}
    )
    RETURNING event_id, (
      SELECT lifecycle_id
      FROM fatigue_incident_lifecycle
      WHERE event_id = edge_fatigue_events.event_id
      LIMIT 1
    ) AS lifecycle_id
  `;

  const row = inserted[0];
  if (!row) {
    return { promoted: false, skippedReason: "insert_failed" };
  }

  return {
    promoted: true,
    eventId: row.event_id,
    lifecycleId: row.lifecycle_id ?? undefined,
  };
}
