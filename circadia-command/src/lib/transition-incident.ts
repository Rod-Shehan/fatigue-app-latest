import type { Prisma } from "@prisma/client";
import { CommandApiError } from "@/lib/errors";
import type { ActorType, LifecycleStatus } from "@/lib/lifecycle-status";
import type { TxClient } from "@/lib/privileged-db";

export type TransitionPayload = {
  lifecycleId: string;
  expectedCurrentStatus: LifecycleStatus;
  targetStatus: LifecycleStatus;
  actorId: string;
  actorType: ActorType;
  notes?: string;
  snapshot: Record<string, unknown>;
};

export async function transitionIncidentState(
  tx: TxClient,
  payload: TransitionPayload
): Promise<void> {
  const { lifecycleId, expectedCurrentStatus, targetStatus, notes } = payload;

  const updated = await tx.fatigueIncidentLifecycle.updateMany({
    where: {
      lifecycleId,
      eventStatus: expectedCurrentStatus,
    },
    data: {
      eventStatus: targetStatus,
      operatorNotes: notes ?? undefined,
      triagedAt:
        targetStatus === "VERIFIED_TRUE_FATIGUE" || targetStatus === "VERIFIED_FALSE_POSITIVE"
          ? new Date()
          : undefined,
      interventionTriggeredAt: targetStatus === "INTERVENTION_SENT" ? new Date() : undefined,
      driverRespondedAt:
        targetStatus === "DRIVER_ACKNOWLEDGED" || targetStatus === "DRIVER_DISPUTED"
          ? new Date()
          : undefined,
      closedAt:
        targetStatus === "VERIFIED_FALSE_POSITIVE" || targetStatus === "CLOSED"
          ? new Date()
          : undefined,
    },
  });

  if (updated.count === 0) {
    throw new CommandApiError(
      "ERR_STATE_CONCURRENCY_VIOLATION",
      "Incident state changed before this action could apply.",
      409
    );
  }

  await tx.lifecycleTransitionLog.create({
    data: {
      lifecycleId,
      fromStatus: expectedCurrentStatus,
      toStatus: targetStatus,
      triggeredById: payload.actorId,
      actorType: payload.actorType,
      transitionPayloadSnapshot: payload.snapshot as Prisma.InputJsonValue,
    },
  });
}
