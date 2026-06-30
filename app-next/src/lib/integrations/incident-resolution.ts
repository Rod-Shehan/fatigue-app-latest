import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";
import {
  recordCameraAlertTriage,
  type CameraAlertTriageRecord,
} from "@/lib/integrations/camera-alert-triage";
import { syncCommandLifecycleFromManagerTriage } from "@/lib/integrations/manager-lifecycle-sync";
import type { IncidentResolutionActionType } from "@/lib/triage-resolution";
import { formatResolutionAuditNote } from "@/lib/triage-resolution";

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

  const lifecycle = await syncCommandLifecycleFromManagerTriage(prisma, {
    ingestEventId: args.ingestEventId,
    decision: "authorized",
    note: auditNote,
  });

  if (lifecycle.lifecycleId) {
    await prisma.incidentActionLog.updateMany({
      where: { ingestEventId: args.ingestEventId, lifecycleId: null },
      data: { lifecycleId: lifecycle.lifecycleId },
    });
  }

  return {
    triage,
    lifecycleId: lifecycle.lifecycleId,
    lifecycleStatus: lifecycle.lifecycleStatus,
  };
}
