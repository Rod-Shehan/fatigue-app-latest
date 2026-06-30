import { CommandApiError } from "@/lib/errors";
import type { LifecycleStatus } from "@/lib/lifecycle-status";
import type { TriageAction } from "@/lib/lifecycle-status";
import type { TxClient } from "@/lib/privileged-db";
import { syncManagerCameraAlertTriage } from "@/lib/sync-manager-triage";
import { transitionIncidentState } from "@/lib/transition-incident";

export async function applyOperatorTriageAction(
  tx: TxClient,
  args: {
    lifecycleId: string;
    action: TriageAction;
    operatorId: string;
    operatorNotes?: string;
    idempotencyKey: string;
  }
): Promise<{ status: LifecycleStatus }> {
  const row = await tx.fatigueIncidentLifecycle.findUnique({
    where: { lifecycleId: args.lifecycleId },
  });
  if (!row) {
    throw new Error("NOT_FOUND");
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
      "Claim this incident before acting on it.",
      409
    );
  }

  if (args.action === "VERIFIED_FALSE_POSITIVE") {
    await transitionIncidentState(tx, {
      lifecycleId: args.lifecycleId,
      expectedCurrentStatus: "PENDING_TRIAGE",
      targetStatus: "VERIFIED_FALSE_POSITIVE",
      actorId: args.operatorId,
      actorType: "OPERATOR",
      notes: args.operatorNotes,
      snapshot: { idempotency_key: args.idempotencyKey, action: args.action },
    });
    await syncManagerCameraAlertTriage(tx, args);
    return { status: "VERIFIED_FALSE_POSITIVE" };
  }

  await transitionIncidentState(tx, {
    lifecycleId: args.lifecycleId,
    expectedCurrentStatus: "PENDING_TRIAGE",
    targetStatus: "VERIFIED_TRUE_FATIGUE",
    actorId: args.operatorId,
    actorType: "OPERATOR",
    notes: args.operatorNotes,
    snapshot: { idempotency_key: args.idempotencyKey, action: args.action },
  });
  await syncManagerCameraAlertTriage(tx, args);
  await transitionIncidentState(tx, {
    lifecycleId: args.lifecycleId,
    expectedCurrentStatus: "VERIFIED_TRUE_FATIGUE",
    targetStatus: "INTERVENTION_SENT",
    actorId: "SYSTEM",
    actorType: "SYSTEM",
    snapshot: { reason: "operator_triage_confirmed" },
  });
  await transitionIncidentState(tx, {
    lifecycleId: args.lifecycleId,
    expectedCurrentStatus: "INTERVENTION_SENT",
    targetStatus: "CLOSED",
    actorId: args.operatorId,
    actorType: "OPERATOR",
    notes: args.operatorNotes,
    snapshot: { reason: "operator_triage_closed", action: args.action },
  });
  return { status: "CLOSED" };
}
