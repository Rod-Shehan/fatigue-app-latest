import type { QueueIncident } from "@/hooks/use-triage-queue";
import type { TxClient } from "@/lib/privileged-db";
import { isEdgeManagerTriaged } from "@/lib/reconcile-manager-triage";

export async function fetchIncidentForSse(
  tx: TxClient,
  lifecycleId: string
): Promise<QueueIncident | null> {
  const row = await tx.fatigueIncidentLifecycle.findUnique({
    where: { lifecycleId },
    include: { event: true, operator: true },
  });
  if (!row || row.eventStatus !== "PENDING_TRIAGE") return null;
  if (await isEdgeManagerTriaged(tx, row.event.sourceIngestId)) return null;

  const actorType =
    row.claimedByActorType === "manager" || row.claimedByActorType === "command_operator"
      ? row.claimedByActorType
      : row.operatorId
        ? "command_operator"
        : row.claimedByUserId
          ? "manager"
          : null;

  let claimedLabel: string | null = null;
  if (actorType === "command_operator") {
    claimedLabel = row.operator?.fullName ?? null;
  } else if (actorType === "manager" && row.claimedByUserId) {
    const users = await tx.$queryRaw<Array<{ name: string | null; email: string | null }>>`
      SELECT name, email FROM "User" WHERE id = ${row.claimedByUserId} LIMIT 1
    `;
    const managerUser = users[0];
    claimedLabel = managerUser?.name?.trim() || managerUser?.email || "Manager";
  }

  return {
    lifecycle_id: row.lifecycleId,
    event_id: row.eventId,
    vehicle_registration: row.event.vehicleRegistration,
    fatigue_metric_type: row.event.fatigueMetricType,
    confidence_score: Number(row.event.confidenceScore),
    detected_at: row.detectedAt.toISOString(),
    video_snippet_url: row.event.videoSnippetUrl,
    lock_holder_id: row.operatorId ?? row.claimedByUserId,
    claimed_by_actor_type: actorType,
    claimed_by_label: claimedLabel,
    claimed_at: row.claimedAt?.toISOString() ?? null,
  };
}
