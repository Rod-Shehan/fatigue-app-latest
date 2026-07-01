import { randomUUID } from "crypto";
import { CommandApiError } from "@/lib/errors";
import type { IncidentResolutionActionType } from "@/lib/triage-resolution";
import { formatResolutionAuditNote } from "@/lib/triage-resolution";
import { syncManagerCameraAlertTriage } from "@/lib/sync-manager-triage";
import {
  formatVerifiedDistractionReasonsForNote,
  VERIFIED_DISTRACTION_ACTION_TYPE,
  type VerifiedDistractionReasonId,
} from "@/lib/verified-distraction-reasons";
import { transitionIncidentState } from "@/lib/transition-incident";
import type { TxClient } from "@/lib/privileged-db";

export async function releaseTriageClaim(
  tx: TxClient,
  args: { lifecycleId: string; operatorId: string }
): Promise<boolean> {
  const updated = await tx.fatigueIncidentLifecycle.updateMany({
    where: {
      lifecycleId: args.lifecycleId,
      operatorId: args.operatorId,
      eventStatus: "PENDING_TRIAGE",
    },
    data: {
      operatorId: null,
      claimedAt: null,
      claimedByActorType: null,
      claimedByUserId: null,
    },
  });
  return updated.count > 0;
}

export async function completeOperatorResolution(
  tx: TxClient,
  args: {
    lifecycleId: string;
    operatorId: string;
    operatorName: string;
    actionType: IncidentResolutionActionType;
    resolutionNotes?: string | null;
    idempotencyKey: string;
  }
): Promise<{ status: string }> {
  const row = await tx.fatigueIncidentLifecycle.findUnique({
    where: { lifecycleId: args.lifecycleId },
    include: { event: true },
  });
  if (!row) {
    throw new CommandApiError("ERR_NOT_FOUND", "Incident not found.", 404);
  }
  if (row.eventStatus !== "PENDING_TRIAGE") {
    throw new CommandApiError(
      "ERR_STATE_CONCURRENCY_VIOLATION",
      "Incident is no longer awaiting resolution.",
      409
    );
  }
  if (row.claimedByUserId) {
    throw new CommandApiError(
      "ERR_INCIDENT_ALREADY_CLAIMED",
      "This safety event has been claimed on the manager desk.",
      409
    );
  }
  if (!row.operatorId) {
    throw new CommandApiError(
      "ERR_STATE_CONCURRENCY_VIOLATION",
      "Claim this incident before resolving.",
      409
    );
  }
  if (row.operatorId !== args.operatorId) {
    throw new CommandApiError(
      "ERR_INCIDENT_ALREADY_CLAIMED",
      "This safety event has already been claimed by another operations seat.",
      409
    );
  }

  const auditNote = formatResolutionAuditNote(args.actionType, args.resolutionNotes);

  await transitionIncidentState(tx, {
    lifecycleId: args.lifecycleId,
    expectedCurrentStatus: "PENDING_TRIAGE",
    targetStatus: "VERIFIED_TRUE_FATIGUE",
    actorId: args.operatorId,
    actorType: "OPERATOR",
    notes: auditNote,
    snapshot: {
      idempotency_key: args.idempotencyKey,
      action: "VERIFIED_TRUE_FATIGUE",
      resolution_action: args.actionType,
    },
  });

  await syncManagerCameraAlertTriage(tx, {
    lifecycleId: args.lifecycleId,
    action: "VERIFIED_TRUE_FATIGUE",
    operatorId: args.operatorId,
    operatorNotes: auditNote,
  });

  await tx.incidentActionLog.create({
    data: {
      id: randomUUID(),
      lifecycleId: args.lifecycleId,
      ingestEventId: row.event.sourceIngestId,
      actionType: args.actionType,
      resolutionNotes: args.resolutionNotes?.trim() || null,
      actorType: "command_operator",
      actorId: args.operatorId,
      actorLabel: args.operatorName,
    },
  });

  await transitionIncidentState(tx, {
    lifecycleId: args.lifecycleId,
    expectedCurrentStatus: "VERIFIED_TRUE_FATIGUE",
    targetStatus: "INTERVENTION_SENT",
    actorId: "SYSTEM",
    actorType: "SYSTEM",
    snapshot: { reason: "resolution_recorded" },
  });

  await transitionIncidentState(tx, {
    lifecycleId: args.lifecycleId,
    expectedCurrentStatus: "INTERVENTION_SENT",
    targetStatus: "CLOSED",
    actorId: args.operatorId,
    actorType: "OPERATOR",
    notes: auditNote,
    snapshot: { reason: "resolution_closed", resolution_action: args.actionType },
  });

  return { status: "CLOSED" };
}

export async function completeOperatorVerifiedDistraction(
  tx: TxClient,
  args: {
    lifecycleId: string;
    operatorId: string;
    operatorName: string;
    verifiedDistractionReasons: VerifiedDistractionReasonId[];
    note?: string | null;
    idempotencyKey: string;
  }
): Promise<{ status: string }> {
  const row = await tx.fatigueIncidentLifecycle.findUnique({
    where: { lifecycleId: args.lifecycleId },
    include: { event: true },
  });
  if (!row) {
    throw new CommandApiError("ERR_NOT_FOUND", "Incident not found.", 404);
  }
  if (row.eventStatus !== "PENDING_TRIAGE") {
    throw new CommandApiError(
      "ERR_STATE_CONCURRENCY_VIOLATION",
      "Incident is no longer awaiting resolution.",
      409
    );
  }
  if (row.claimedByUserId) {
    throw new CommandApiError(
      "ERR_INCIDENT_ALREADY_CLAIMED",
      "This safety event has been claimed on the manager desk.",
      409
    );
  }
  if (!row.operatorId || row.operatorId !== args.operatorId) {
    throw new CommandApiError(
      "ERR_STATE_CONCURRENCY_VIOLATION",
      "Claim this incident before resolving.",
      409
    );
  }

  const auditNote = formatVerifiedDistractionReasonsForNote(
    args.verifiedDistractionReasons,
    args.note
  );

  await transitionIncidentState(tx, {
    lifecycleId: args.lifecycleId,
    expectedCurrentStatus: "PENDING_TRIAGE",
    targetStatus: "VERIFIED_TRUE_FATIGUE",
    actorId: args.operatorId,
    actorType: "OPERATOR",
    notes: auditNote,
    snapshot: {
      idempotency_key: args.idempotencyKey,
      action: "VERIFIED_TRUE_FATIGUE",
      verified_kind: "distraction",
      verified_distraction_reasons: args.verifiedDistractionReasons,
    },
  });

  await syncManagerCameraAlertTriage(tx, {
    lifecycleId: args.lifecycleId,
    action: "VERIFIED_TRUE_FATIGUE",
    operatorId: args.operatorId,
    operatorNotes: args.note ?? undefined,
    verifiedDistractionReasons: args.verifiedDistractionReasons,
  });

  await tx.incidentActionLog.create({
    data: {
      id: randomUUID(),
      lifecycleId: args.lifecycleId,
      ingestEventId: row.event.sourceIngestId,
      actionType: VERIFIED_DISTRACTION_ACTION_TYPE,
      resolutionNotes: args.note?.trim() || null,
      actorType: "command_operator",
      actorId: args.operatorId,
      actorLabel: args.operatorName,
    },
  });

  await transitionIncidentState(tx, {
    lifecycleId: args.lifecycleId,
    expectedCurrentStatus: "VERIFIED_TRUE_FATIGUE",
    targetStatus: "INTERVENTION_SENT",
    actorId: "SYSTEM",
    actorType: "SYSTEM",
    snapshot: { reason: "verified_distraction_recorded" },
  });

  await transitionIncidentState(tx, {
    lifecycleId: args.lifecycleId,
    expectedCurrentStatus: "INTERVENTION_SENT",
    targetStatus: "CLOSED",
    actorId: args.operatorId,
    actorType: "OPERATOR",
    notes: auditNote,
    snapshot: {
      reason: "verified_distraction_closed",
      verified_distraction_reasons: args.verifiedDistractionReasons,
    },
  });

  return { status: "CLOSED" };
}
