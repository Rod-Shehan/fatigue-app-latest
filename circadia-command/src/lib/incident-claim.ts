import { randomUUID } from "crypto";
import { CommandApiError } from "@/lib/errors";
import type { TxClient } from "@/lib/privileged-db";

async function logClaimAudit(
  tx: TxClient,
  args: {
    lifecycleId: string;
    operatorId: string;
    action: "claimed" | "claim_released";
    snapshot: Record<string, unknown>;
  }
): Promise<void> {
  await tx.lifecycleTransitionLog.create({
    data: {
      logId: randomUUID(),
      lifecycleId: args.lifecycleId,
      fromStatus: "PENDING_TRIAGE",
      toStatus: "PENDING_TRIAGE",
      triggeredById: args.operatorId,
      actorType: "OPERATOR",
      transitionPayloadSnapshot: { ...args.snapshot, action: args.action },
    },
  });
}

export async function claimIncidentForOperator(
  tx: TxClient,
  args: { lifecycleId: string; operatorId: string; operatorName: string }
): Promise<{ lifecycle_id: string; operator_id: string }> {
  const updated = await tx.fatigueIncidentLifecycle.updateMany({
    where: {
      lifecycleId: args.lifecycleId,
      eventStatus: "PENDING_TRIAGE",
      operatorId: null,
      claimedByUserId: null,
    },
    data: {
      operatorId: args.operatorId,
      claimedAt: new Date(),
      claimedByActorType: "command_operator",
      claimedByUserId: null,
    },
  });

  if (updated.count === 0) {
    const existing = await tx.fatigueIncidentLifecycle.findUnique({
      where: { lifecycleId: args.lifecycleId },
      include: { operator: true },
    });
    if (!existing) {
      throw new CommandApiError("ERR_NOT_FOUND", "Incident not found.", 404);
    }
    throw new CommandApiError(
      "ERR_INCIDENT_ALREADY_CLAIMED",
      "This safety event has already been claimed by another operations seat.",
      409
    );
  }

  await logClaimAudit(tx, {
    lifecycleId: args.lifecycleId,
    operatorId: args.operatorId,
    action: "claimed",
    snapshot: { actor_label: args.operatorName, claimed_by_actor_type: "command_operator" },
  });

  return { lifecycle_id: args.lifecycleId, operator_id: args.operatorId };
}
