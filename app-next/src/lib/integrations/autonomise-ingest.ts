import type { Prisma, PrismaClient } from "@prisma/client";
import {
  buildAutonomiseIdempotencyKey,
  extractAutonomiseFields,
} from "@/lib/integrations/autonomise-payload";
import {
  defaultEnabledAlarmIds,
  getCatalogueEntry,
  isVendorAlarmAccepted,
  type FatigueEventPresetId,
} from "@/lib/integrations/fatigue-event-catalogue";

import type { AutonomiseWebhookKind } from "@/lib/integrations/autonomise-payload";

export type AutonomiseIngestResult = {
  id: string;
  kind: AutonomiseWebhookKind;
  accepted: boolean;
  duplicate: boolean;
  vendorAlarmId: string | null;
  displayName: string | null;
  rejectReason: string | null;
  vehicleRego: string | null;
  driverName: string | null;
  linkedEventId: string | null;
  mediaUrl: string | null;
};

function resolveEnabledAlarms(preset: FatigueEventPresetId): Set<string> {
  return new Set(defaultEnabledAlarmIds(preset));
}

function evaluateAcceptance(
  kind: AutonomiseWebhookKind,
  vendorAlarmId: string | null,
  enabledAlarms: ReadonlySet<string>
): { accepted: boolean; rejectReason: string | null } {
  if (kind === "media") {
    return { accepted: true, rejectReason: null };
  }
  if (!vendorAlarmId) {
    return { accepted: false, rejectReason: "missing_alarm_id" };
  }
  const entry = getCatalogueEntry(vendorAlarmId);
  if (!entry) {
    return { accepted: false, rejectReason: "unknown_alarm_id" };
  }
  if (entry.tier === "excluded" || entry.pipeline === null) {
    return { accepted: false, rejectReason: "excluded_alarm" };
  }
  if (!isVendorAlarmAccepted(vendorAlarmId, enabledAlarms)) {
    return { accepted: false, rejectReason: "alarm_not_enabled_for_tenant" };
  }
  return { accepted: true, rejectReason: null };
}

export async function ingestAutonomiseWebhook(
  prisma: PrismaClient,
  args: {
    kind: AutonomiseWebhookKind;
    payload: unknown;
    preset: FatigueEventPresetId;
  }
): Promise<AutonomiseIngestResult> {
  const fields = extractAutonomiseFields(args.payload, args.kind);
  const enabledAlarms = resolveEnabledAlarms(args.preset);
  const { accepted, rejectReason } = evaluateAcceptance(args.kind, fields.vendorAlarmId, enabledAlarms);
  const idempotencyKey = buildAutonomiseIdempotencyKey(args.kind, fields, args.payload);
  const entry = fields.vendorAlarmId ? getCatalogueEntry(fields.vendorAlarmId) : undefined;

  const data: Prisma.AutonomiseWebhookIngestCreateInput = {
    kind: args.kind,
    idempotencyKey,
    vendorAlarmId: fields.vendorAlarmId,
    vendorEventId: fields.vendorEventId,
    vehicleRego: fields.vehicleRego,
    driverName: fields.driverName,
    linkedEventId: fields.linkedEventId,
    mediaUrl: fields.mediaUrl,
    accepted,
    rejectReason,
    payload: args.payload as Prisma.InputJsonValue,
  };

  if (idempotencyKey) {
    const existing = await prisma.autonomiseWebhookIngest.findUnique({
      where: { kind_idempotencyKey: { kind: args.kind, idempotencyKey } },
      select: {
        id: true,
        accepted: true,
        vendorAlarmId: true,
        vehicleRego: true,
        driverName: true,
        linkedEventId: true,
        mediaUrl: true,
      },
    });
    if (existing) {
      return {
        id: existing.id,
        kind: args.kind,
        accepted: existing.accepted,
        duplicate: true,
        vendorAlarmId: existing.vendorAlarmId,
        displayName: existing.vendorAlarmId ? getCatalogueEntry(existing.vendorAlarmId)?.displayName ?? null : null,
        rejectReason: null,
        vehicleRego: existing.vehicleRego,
        driverName: existing.driverName,
        linkedEventId: existing.linkedEventId,
        mediaUrl: existing.mediaUrl,
      };
    }
  }

  const row = await prisma.autonomiseWebhookIngest.create({ data });

  return {
    id: row.id,
    kind: args.kind,
    accepted,
    duplicate: false,
    vendorAlarmId: fields.vendorAlarmId,
    displayName: entry?.displayName ?? null,
    rejectReason,
    vehicleRego: fields.vehicleRego,
    driverName: fields.driverName,
    linkedEventId: fields.linkedEventId,
    mediaUrl: fields.mediaUrl,
  };
}
