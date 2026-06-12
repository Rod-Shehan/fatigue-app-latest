import type { QueueIncident } from "@/hooks/use-triage-queue";
import type { TxClient } from "@/lib/privileged-db";

export async function fetchIncidentForSse(
  tx: TxClient,
  lifecycleId: string
): Promise<QueueIncident | null> {
  const row = await tx.fatigueIncidentLifecycle.findUnique({
    where: { lifecycleId },
    include: { event: true },
  });
  if (!row) return null;

  return {
    lifecycle_id: row.lifecycleId,
    event_id: row.eventId,
    vehicle_registration: row.event.vehicleRegistration,
    fatigue_metric_type: row.event.fatigueMetricType,
    confidence_score: Number(row.event.confidenceScore),
    detected_at: row.detectedAt.toISOString(),
    video_snippet_url: row.event.videoSnippetUrl,
    lock_holder_id: row.operatorId,
  };
}
