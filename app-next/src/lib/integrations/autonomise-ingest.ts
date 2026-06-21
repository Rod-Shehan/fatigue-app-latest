import type { Prisma, PrismaClient } from "@prisma/client";
import {
  buildAutonomiseIdempotencyKey,
  extractAutonomiseFields,
} from "@/lib/integrations/autonomise-payload";
import {
  getCatalogueEntry,
  type FatigueEventPresetId,
} from "@/lib/integrations/fatigue-event-catalogue";
import { evaluateAutonomiseEventAcceptance } from "@/lib/integrations/autonomise-event-evaluation";
import { isAutonomiseApiConfigured } from "@/lib/integrations/autonomise-api-client";
import {
  fnolSlugFromPayload,
  resolveAndPersistAutonomiseMedia,
} from "@/lib/integrations/autonomise-media-resolver";

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

function evaluateAcceptance(
  kind: AutonomiseWebhookKind,
  vendorAlarmId: string | null,
  preset: FatigueEventPresetId
): { accepted: boolean; rejectReason: string | null } {
  if (kind === "media") {
    return { accepted: true, rejectReason: null };
  }
  return evaluateAutonomiseEventAcceptance(vendorAlarmId, preset);
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
  const { accepted, rejectReason } = evaluateAcceptance(args.kind, fields.vendorAlarmId, args.preset);
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

  let mediaUrl = fields.mediaUrl;
  let driverName = fields.driverName;
  const eventIdForMedia = fields.vendorEventId ?? fields.linkedEventId;
  const shouldFetchMedia =
    eventIdForMedia &&
    isAutonomiseApiConfigured() &&
    ((args.kind === "event" && accepted) || (args.kind === "media" && !mediaUrl));

  if (shouldFetchMedia) {
    try {
      const resolved = await resolveAndPersistAutonomiseMedia(prisma, {
        eventId: eventIdForMedia,
        fnolSlug: fnolSlugFromPayload(args.payload),
        payload: args.payload,
      });
      if (resolved?.mediaUrl) mediaUrl = resolved.mediaUrl;
      if (resolved?.driverName) driverName = resolved.driverName;
    } catch (e) {
      console.warn(
        "[autonomise-ingest] media fetch failed",
        eventIdForMedia,
        e instanceof Error ? e.message : e
      );
    }
  }

  return {
    id: row.id,
    kind: args.kind,
    accepted,
    duplicate: false,
    vendorAlarmId: fields.vendorAlarmId,
    displayName: entry?.displayName ?? null,
    rejectReason,
    vehicleRego: fields.vehicleRego,
    driverName,
    linkedEventId: fields.linkedEventId,
    mediaUrl,
  };
}
