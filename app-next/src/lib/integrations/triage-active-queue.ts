/**
 * Active triage queue — same pending definition as circadia-command triage-queue.ts (§3.5 Phase 1).
 */

import type { PrismaClient } from "@prisma/client";

export type TriageQueueSummary = {
  /** Pending on shared lifecycle queue (matches Command queue_depth). */
  activePending: number;
  /** Hours window for history browse; null on Need review (active-only). */
  browseHours: number | null;
};

export type ActiveTriageQueueRow = {
  lifecycle_id: string;
  source_ingest_id: string | null;
  detected_at: Date;
  vehicle_registration: string;
  fatigue_metric_type: string;
  video_snippet_url: string;
  hardware_timestamp: Date;
};

export type QueueBurstTarget = {
  vehicleRego: string | null;
  triggerAt?: string | null;
  receivedAt: string;
  queueBurstLabel?: string | null;
};

/** Exclude rows manager already decided (same SQL as Command countPendingTriage). */
export async function countActiveTriagePending(prisma: PrismaClient): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM fatigue_incident_lifecycle l
    INNER JOIN edge_fatigue_events e ON e.event_id = l.event_id
    WHERE l.event_status = 'PENDING_TRIAGE'
      AND NOT EXISTS (
        SELECT 1
        FROM "CameraAlertTriage" t
        WHERE t."ingestEventId" = e.source_ingest_id
           OR (
             t."vendorEventId" IS NOT NULL
             AND EXISTS (
               SELECT 1
               FROM "AutonomiseWebhookIngest" i
               WHERE i.id = e.source_ingest_id
                 AND i."vendorEventId" = t."vendorEventId"
             )
           )
      )
  `;
  return rows[0]?.count ?? 0;
}

export async function fetchActiveTriageQueueRows(
  prisma: PrismaClient,
  limit: number
): Promise<ActiveTriageQueueRow[]> {
  return prisma.$queryRaw<ActiveTriageQueueRow[]>`
    SELECT
      l.lifecycle_id::text AS lifecycle_id,
      e.source_ingest_id,
      l.detected_at,
      e.vehicle_registration,
      e.fatigue_metric_type,
      e.video_snippet_url,
      e.hardware_timestamp
    FROM fatigue_incident_lifecycle l
    INNER JOIN edge_fatigue_events e ON e.event_id = l.event_id
    WHERE l.event_status = 'PENDING_TRIAGE'
      AND NOT EXISTS (
        SELECT 1
        FROM "CameraAlertTriage" t
        WHERE t."ingestEventId" = e.source_ingest_id
           OR (
             t."vendorEventId" IS NOT NULL
             AND EXISTS (
               SELECT 1
               FROM "AutonomiseWebhookIngest" i
               WHERE i.id = e.source_ingest_id
                 AND i."vendorEventId" = t."vendorEventId"
             )
           )
      )
    ORDER BY l.detected_at DESC, l.lifecycle_id DESC
    LIMIT ${limit}
  `;
}

export function buildQueueBurstLabels(alerts: QueueBurstTarget[]): void {
  const byRego = new Map<string, QueueBurstTarget[]>();
  for (const alert of alerts) {
    const rego = alert.vehicleRego?.trim().toUpperCase() || "UNKNOWN";
    const bucket = byRego.get(rego) ?? [];
    bucket.push(alert);
    byRego.set(rego, bucket);
  }

  for (const group of byRego.values()) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort(
      (a, b) =>
        new Date(a.triggerAt ?? a.receivedAt).getTime() -
        new Date(b.triggerAt ?? b.receivedAt).getTime()
    );
    sorted.forEach((alert, index) => {
      alert.queueBurstLabel = `Event ${index + 1} of ${sorted.length} for ${alert.vehicleRego} in active queue`;
    });
  }
}
