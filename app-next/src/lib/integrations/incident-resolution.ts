import type { PrismaClient } from "@prisma/client";
import {
  recordCameraAlertTriage,
  recordCameraAlertVerifiedDistraction,
  type CameraAlertTriageRecord,
} from "@/lib/integrations/camera-alert-triage";
import { applyManagerVerifiedResolutionFromPending } from "@/lib/integrations/incident-lifecycle-transition";
import type { IncidentResolutionActionType } from "@/lib/triage-resolution";
import { formatResolutionAuditNote } from "@/lib/triage-resolution";
import { VERIFIED_DISTRACTION_ACTION_TYPE } from "@/lib/integrations/verified-distraction-reasons";

export type ManagerResolutionResult = {
  triage: CameraAlertTriageRecord;
  lifecycleId: string | null;
  lifecycleStatus: string | null;
};

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

  const lifecycle = await applyManagerVerifiedResolutionFromPending(prisma, {
    ingestEventId: args.ingestEventId,
    actorId: args.decidedByUserId,
    auditNote,
    resolutionActionType: args.actionType,
    idempotencyKey: `manager_resolve_${args.ingestEventId}`,
  });

  await prisma.incidentActionLog.create({
    data: {
      ingestEventId: args.ingestEventId,
      actionType: args.actionType,
      resolutionNotes: args.resolutionNotes?.trim() || null,
      actorType: "manager",
      actorId: args.decidedByUserId,
      actorLabel: args.decidedByName ?? args.decidedByEmail,
      lifecycleId: lifecycle.lifecycleId,
    },
  });

  return {
    triage,
    lifecycleId: lifecycle.lifecycleId,
    lifecycleStatus: lifecycle.lifecycleStatus,
  };
}

export async function completeManagerVerifiedDistraction(
  prisma: PrismaClient,
  args: {
    ingestEventId: string;
    vendorEventId: string | null;
    verifiedDistractionReasons: unknown;
    note?: string | null;
    decidedByUserId: string;
    decidedByEmail: string | null;
    decidedByName: string | null;
  }
): Promise<ManagerResolutionResult> {
  const triage = await recordCameraAlertVerifiedDistraction(prisma, {
    ingestEventId: args.ingestEventId,
    vendorEventId: args.vendorEventId,
    verifiedDistractionReasons: args.verifiedDistractionReasons,
    note: args.note,
    decidedByUserId: args.decidedByUserId,
    decidedByEmail: args.decidedByEmail,
  });

  const lifecycle = await applyManagerVerifiedResolutionFromPending(prisma, {
    ingestEventId: args.ingestEventId,
    actorId: args.decidedByUserId,
    auditNote: triage.note ?? "Verified distraction",
    resolutionActionType: VERIFIED_DISTRACTION_ACTION_TYPE,
    idempotencyKey: `manager_verify_distraction_${args.ingestEventId}`,
  });

  await prisma.incidentActionLog.create({
    data: {
      ingestEventId: args.ingestEventId,
      actionType: VERIFIED_DISTRACTION_ACTION_TYPE,
      resolutionNotes: args.note?.trim() || null,
      actorType: "manager",
      actorId: args.decidedByUserId,
      actorLabel: args.decidedByName ?? args.decidedByEmail,
      lifecycleId: lifecycle.lifecycleId,
    },
  });

  return {
    triage,
    lifecycleId: lifecycle.lifecycleId,
    lifecycleStatus: lifecycle.lifecycleStatus,
  };
}
