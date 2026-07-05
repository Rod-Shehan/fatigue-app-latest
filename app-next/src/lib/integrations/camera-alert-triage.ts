import type { Prisma, PrismaClient } from "@prisma/client";
import { extractAutonomiseFields } from "@/lib/integrations/autonomise-payload";
import { evaluateAutonomiseEventAcceptance } from "@/lib/integrations/autonomise-event-evaluation";
import { getEnabledAlarmIdSet } from "@/lib/integrations/camera-alert-event-settings";
import {
  formatFalsePositiveReasonsForNote,
  normalizeFalsePositiveReasons,
  requireFalsePositiveReasonsForDismiss,
  type FalsePositiveReasonId,
} from "@/lib/integrations/false-positive-reasons";
import {
  formatVerifiedDistractionReasonsForNote,
  normalizeVerifiedDistractionReasons,
  requireVerifiedDistractionReasons,
  type VerifiedDistractionReasonId,
} from "@/lib/integrations/verified-distraction-reasons";
import { assertTriageTriggerFreeNoteWhenRequired } from "@/lib/integrations/triage-trigger-reasons";

export type CameraAlertTriageDecision = "authorized" | "dismissed";

export type CameraAlertTriageRecord = {
  ingestEventId: string;
  vendorEventId: string | null;
  decision: CameraAlertTriageDecision;
  note: string | null;
  falsePositiveReasons: FalsePositiveReasonId[];
  verifiedDistractionReasons: VerifiedDistractionReasonId[];
  decidedByUserId: string;
  decidedByEmail: string | null;
  decidedAt: Date;
};

export async function loadTriageByIngestIds(
  prisma: PrismaClient,
  ingestEventIds: string[]
): Promise<Map<string, CameraAlertTriageRecord>> {
  if (ingestEventIds.length === 0) return new Map();

  const rows = await prisma.cameraAlertTriage.findMany({
    where: { ingestEventId: { in: ingestEventIds } },
  });

  const map = new Map<string, CameraAlertTriageRecord>();
  for (const row of rows) {
    if (row.decision !== "authorized" && row.decision !== "dismissed") continue;
    map.set(row.ingestEventId, {
      ingestEventId: row.ingestEventId,
      vendorEventId: row.vendorEventId,
      decision: row.decision,
      note: row.note,
      falsePositiveReasons: normalizeFalsePositiveReasons(row.falsePositiveReasons),
      verifiedDistractionReasons: normalizeVerifiedDistractionReasons(row.verifiedDistractionReasons),
      decidedByUserId: row.decidedByUserId,
      decidedByEmail: row.decidedByEmail,
      decidedAt: row.decidedAt,
    });
  }
  return map;
}

export async function recordCameraAlertTriage(
  prisma: PrismaClient,
  args: {
    ingestEventId: string;
    vendorEventId: string | null;
    decision: CameraAlertTriageDecision;
    note?: string | null;
    falsePositiveReasons?: unknown;
    decidedByUserId: string;
    decidedByEmail: string | null;
  }
): Promise<CameraAlertTriageRecord> {
  const existing = await prisma.cameraAlertTriage.findUnique({
    where: { ingestEventId: args.ingestEventId },
  });
  if (existing) {
    throw new Error("ALREADY_DECIDED");
  }

  const eventRow = await prisma.autonomiseWebhookIngest.findFirst({
    where: { id: args.ingestEventId, kind: "event" },
    select: {
      id: true,
      vendorAlarmId: true,
      vendorEventId: true,
      linkedEventId: true,
      vehicleRego: true,
      driverName: true,
      accepted: true,
      rejectReason: true,
      payload: true,
    },
  });
  if (!eventRow) {
    throw new Error("EVENT_NOT_FOUND");
  }

  const enabledAlarmIds = await getEnabledAlarmIdSet(prisma);
  const fields = extractAutonomiseFields(eventRow.payload as Prisma.JsonValue, "event");
  const vendorAlarmId = fields.vendorAlarmId ?? eventRow.vendorAlarmId;
  const { accepted, rejectReason } = evaluateAutonomiseEventAcceptance(vendorAlarmId, enabledAlarmIds);
  if (!accepted) {
    throw new Error("EVENT_NOT_FOUND");
  }

  if (
    !eventRow.accepted ||
    eventRow.rejectReason !== rejectReason ||
    eventRow.vendorAlarmId !== vendorAlarmId
  ) {
    await prisma.autonomiseWebhookIngest.update({
      where: { id: eventRow.id },
      data: {
        accepted: true,
        rejectReason: null,
        vendorAlarmId,
        vendorEventId: fields.vendorEventId ?? eventRow.vendorEventId,
        linkedEventId: fields.linkedEventId ?? eventRow.linkedEventId,
        vehicleRego: fields.vehicleRego ?? eventRow.vehicleRego,
        driverName: fields.driverName ?? eventRow.driverName,
      },
    });
  }

  const falsePositiveReasons = requireFalsePositiveReasonsForDismiss(
    args.decision,
    args.falsePositiveReasons
  );
  if (args.decision === "dismissed") {
    assertTriageTriggerFreeNoteWhenRequired(falsePositiveReasons, args.note);
  }
  const note =
    args.decision === "dismissed"
      ? formatFalsePositiveReasonsForNote(falsePositiveReasons, args.note)
      : args.note?.trim() || null;

  const row = await prisma.cameraAlertTriage.create({
    data: {
      ingestEventId: args.ingestEventId,
      vendorEventId: args.vendorEventId,
      decision: args.decision,
      note,
      falsePositiveReasons:
        args.decision === "dismissed" ? (falsePositiveReasons as Prisma.InputJsonValue) : undefined,
      decidedByUserId: args.decidedByUserId,
      decidedByEmail: args.decidedByEmail,
    },
  });

  return {
    ingestEventId: row.ingestEventId,
    vendorEventId: row.vendorEventId,
    decision: row.decision as CameraAlertTriageDecision,
    note: row.note,
    falsePositiveReasons: normalizeFalsePositiveReasons(row.falsePositiveReasons),
    verifiedDistractionReasons: normalizeVerifiedDistractionReasons(row.verifiedDistractionReasons),
    decidedByUserId: row.decidedByUserId,
    decidedByEmail: row.decidedByEmail,
    decidedAt: row.decidedAt,
  };
}

export async function recordCameraAlertVerifiedDistraction(
  prisma: PrismaClient,
  args: {
    ingestEventId: string;
    vendorEventId: string | null;
    note?: string | null;
    verifiedDistractionReasons: unknown;
    decidedByUserId: string;
    decidedByEmail: string | null;
  }
): Promise<CameraAlertTriageRecord> {
  const existing = await prisma.cameraAlertTriage.findUnique({
    where: { ingestEventId: args.ingestEventId },
  });
  if (existing) {
    throw new Error("ALREADY_DECIDED");
  }

  const eventRow = await prisma.autonomiseWebhookIngest.findFirst({
    where: { id: args.ingestEventId, kind: "event" },
    select: {
      id: true,
      vendorAlarmId: true,
      vendorEventId: true,
      linkedEventId: true,
      vehicleRego: true,
      driverName: true,
      accepted: true,
      rejectReason: true,
      payload: true,
    },
  });
  if (!eventRow) {
    throw new Error("EVENT_NOT_FOUND");
  }

  const enabledAlarmIds = await getEnabledAlarmIdSet(prisma);
  const fields = extractAutonomiseFields(eventRow.payload as Prisma.JsonValue, "event");
  const vendorAlarmId = fields.vendorAlarmId ?? eventRow.vendorAlarmId;
  const { accepted, rejectReason } = evaluateAutonomiseEventAcceptance(vendorAlarmId, enabledAlarmIds);
  if (!accepted) {
    throw new Error("EVENT_NOT_FOUND");
  }

  const verifiedDistractionReasons = requireVerifiedDistractionReasons(args.verifiedDistractionReasons);
  assertTriageTriggerFreeNoteWhenRequired(verifiedDistractionReasons, args.note);
  const note = formatVerifiedDistractionReasonsForNote(verifiedDistractionReasons, args.note);

  const row = await prisma.cameraAlertTriage.create({
    data: {
      ingestEventId: args.ingestEventId,
      vendorEventId: args.vendorEventId,
      decision: "authorized",
      note,
      verifiedDistractionReasons: verifiedDistractionReasons as Prisma.InputJsonValue,
      decidedByUserId: args.decidedByUserId,
      decidedByEmail: args.decidedByEmail,
    },
  });

  return {
    ingestEventId: row.ingestEventId,
    vendorEventId: row.vendorEventId,
    decision: "authorized",
    note: row.note,
    falsePositiveReasons: [],
    verifiedDistractionReasons: normalizeVerifiedDistractionReasons(row.verifiedDistractionReasons),
    decidedByUserId: row.decidedByUserId,
    decidedByEmail: row.decidedByEmail,
    decidedAt: row.decidedAt,
  };
}
