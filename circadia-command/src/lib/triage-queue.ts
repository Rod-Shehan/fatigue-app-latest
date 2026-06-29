import type { TxClient } from "@/lib/privileged-db";
import { hydratePendingEdgeMediaFromIngest } from "@/lib/hydrate-edge-media";

export type QueueCursor = { lastTime: string; lastId: string };

export type QueueIncident = {
  lifecycle_id: string;
  event_id: string;
  vehicle_registration: string;
  fatigue_metric_type: string;
  confidence_score: number;
  detected_at: string;
  video_snippet_url: string;
  lock_holder_id: string | null;
};

export function encodeCursor(cursor: QueueCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(raw: string | null): QueueCursor | null {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as QueueCursor;
  } catch {
    return null;
  }
}

export async function fetchTriageQueue(
  tx: TxClient,
  limit: number,
  cursor: QueueCursor | null
): Promise<{ incidents: QueueIncident[]; hasMore: boolean }> {
  const rows = await tx.fatigueIncidentLifecycle.findMany({
    where: {
      eventStatus: "PENDING_TRIAGE",
      ...(cursor
        ? {
            OR: [
              { detectedAt: { lt: new Date(cursor.lastTime) } },
              {
                detectedAt: new Date(cursor.lastTime),
                lifecycleId: { lt: cursor.lastId },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ detectedAt: "desc" }, { lifecycleId: "desc" }],
    take: limit + 1,
    include: { event: true },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const hydratedClips = await hydratePendingEdgeMediaFromIngest(
    tx,
    page.map((row) => row.eventId)
  );

  return {
    hasMore,
    incidents: page.map((row) => ({
      lifecycle_id: row.lifecycleId,
      event_id: row.eventId,
      vehicle_registration: row.event.vehicleRegistration,
      fatigue_metric_type: row.event.fatigueMetricType,
      confidence_score: Number(row.event.confidenceScore),
      detected_at: row.detectedAt.toISOString(),
      video_snippet_url: hydratedClips.get(row.eventId) ?? row.event.videoSnippetUrl,
      lock_holder_id: row.operatorId,
    })),
  };
}

export async function countPendingTriage(tx: TxClient): Promise<number> {
  return tx.fatigueIncidentLifecycle.count({ where: { eventStatus: "PENDING_TRIAGE" } });
}
