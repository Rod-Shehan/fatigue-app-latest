import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";
import {
  recordCameraAlertTriage,
  type CameraAlertTriageRecord,
} from "@/lib/integrations/camera-alert-triage";
import type { IncidentResolutionActionType } from "@/lib/triage-resolution";
import { formatResolutionAuditNote } from "@/lib/triage-resolution";

export type ManagerResolutionResult = {
  triage: CameraAlertTriageRecord;
  lifecycleId: string | null;
  lifecycleStatus: string | null;
};

async function lookupBridgedLifecycle(
  prisma: PrismaClient,
  ingestEventId: string
): Promise<{ lifecycleId: string; tenantIdUuid: string } | null> {
  const rows = await prisma.$queryRaw<
    Array<{ lifecycle_id: string; tenant_id_uuid: string; event_status: string }>
  >`
    SELECT l.lifecycle_id::text AS lifecycle_id, l.tenant_id_uuid::text AS tenant_id_uuid, l.event_status
    FROM edge_fatigue_events e
    INNER JOIN fatigue_incident_lifecycle l ON l.event_id = e.event_id
    WHERE e.source_ingest_id = ${ingestEventId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.event_status !== "PENDING_TRIAGE") return null;
  return { lifecycleId: row.lifecycle_id, tenantIdUuid: row.tenant_id_uuid };
}

export async function completeManagerIncidentResolution(
  prisma: PrismaClient,
  args: {
    ingestEventId: string;
    vendorEventId: string | null;
    actionType: IncidentResolutionActionType;
    resolutionNotes?: string | null;
    decidedByUserId: string;
    decidedByEmail: string | null;
    decidedByName: string | null;
  }
): Promise<ManagerResolutionResult> {
  const auditNote = formatResolutionAuditNote(args.actionType, args.resolutionNotes);

  const triage = await recordCameraAlertTriage(prisma, {
    ingestEventId: args.ingestEventId,
    vendorEventId: args.vendorEventId,
    decision: "authorized",
    note: auditNote,
    decidedByUserId: args.decidedByUserId,
    decidedByEmail: args.decidedByEmail,
  });

  await prisma.incidentActionLog.create({
    data: {
      ingestEventId: args.ingestEventId,
      actionType: args.actionType,
      resolutionNotes: args.resolutionNotes?.trim() || null,
      actorType: "manager",
      actorId: args.decidedByUserId,
      actorLabel: args.decidedByName ?? args.decidedByEmail,
    },
  });

  const bridged = await lookupBridgedLifecycle(prisma, args.ingestEventId);
  if (!bridged) {
    return { triage, lifecycleId: null, lifecycleStatus: null };
  }

  await prisma.$executeRaw`
    UPDATE fatigue_incident_lifecycle
    SET
      event_status = 'VERIFIED_TRUE_FATIGUE',
      operator_notes = ${auditNote},
      triaged_at = NOW()
    WHERE lifecycle_id = ${bridged.lifecycleId}::uuid
      AND event_status = 'PENDING_TRIAGE'
  `;

  await prisma.$executeRaw`
    UPDATE fatigue_incident_lifecycle
    SET event_status = 'INTERVENTION_SENT', intervention_triggered_at = NOW()
    WHERE lifecycle_id = ${bridged.lifecycleId}::uuid
      AND event_status = 'VERIFIED_TRUE_FATIGUE'
  `;

  await prisma.$executeRaw`
    UPDATE fatigue_incident_lifecycle
    SET event_status = 'CLOSED', closed_at = NOW()
    WHERE lifecycle_id = ${bridged.lifecycleId}::uuid
      AND event_status = 'INTERVENTION_SENT'
  `;

  await prisma.incidentActionLog.updateMany({
    where: { ingestEventId: args.ingestEventId, lifecycleId: null },
    data: { lifecycleId: bridged.lifecycleId },
  });

  return { triage, lifecycleId: bridged.lifecycleId, lifecycleStatus: "CLOSED" };
}
