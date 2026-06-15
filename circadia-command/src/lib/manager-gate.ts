import type { LifecycleStatus } from "@/lib/lifecycle-status";
import type { TriageAction } from "@/lib/lifecycle-status";
import type { TxClient } from "@/lib/privileged-db";
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
): Promise<{ status: LifecycleStatus; managerValidationBypassed: boolean }> {
  const row = await tx.fatigueIncidentLifecycle.findUnique({
    where: { lifecycleId: args.lifecycleId },
  });
  if (!row) {
    throw new Error("NOT_FOUND");
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
    return { status: "VERIFIED_FALSE_POSITIVE", managerValidationBypassed: true };
  }

  const policy = await tx.tenantCompliancePolicyOverride.findUnique({
    where: { tenantIdUuid: row.tenantIdUuid },
  });
  const gateOn = policy?.enforceManagerGate ?? false;

  if (gateOn) {
    await transitionIncidentState(tx, {
      lifecycleId: args.lifecycleId,
      expectedCurrentStatus: "PENDING_TRIAGE",
      targetStatus: "VERIFIED_TRUE_FATIGUE",
      actorId: args.operatorId,
      actorType: "OPERATOR",
      notes: args.operatorNotes,
      snapshot: { idempotency_key: args.idempotencyKey, action: args.action },
    });
    await transitionIncidentState(tx, {
      lifecycleId: args.lifecycleId,
      expectedCurrentStatus: "VERIFIED_TRUE_FATIGUE",
      targetStatus: "MANAGER_VALIDATION_PENDING",
      actorId: "SYSTEM",
      actorType: "SYSTEM",
      snapshot: { reason: "enforce_manager_gate" },
    });
    return { status: "MANAGER_VALIDATION_PENDING", managerValidationBypassed: false };
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
  await transitionIncidentState(tx, {
    lifecycleId: args.lifecycleId,
    expectedCurrentStatus: "VERIFIED_TRUE_FATIGUE",
    targetStatus: "INTERVENTION_SENT",
    actorId: "SYSTEM",
    actorType: "SYSTEM",
    snapshot: { reason: "manager_gate_off" },
  });
  return { status: "INTERVENTION_SENT", managerValidationBypassed: true };
}
