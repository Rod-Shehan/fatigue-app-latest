import { Prisma } from "@prisma/client";
import type { TxClient } from "@/lib/privileged-db";
import { resolveReviewMediaUrl } from "@/lib/autonomise-media-extract";

/**
 * Copy clips from AutonomiseWebhookIngest onto edge_fatigue_events when Command
 * still has a pending:// placeholder or a DSM event is showing the forward camera.
 */
export async function hydratePendingEdgeMediaFromIngest(
  tx: TxClient,
  eventIds: string[]
): Promise<Map<string, string>> {
  if (eventIds.length === 0) return new Map();

  const rows = await tx.$queryRaw<
    Array<{
      event_id: string;
      video_snippet_url: string;
      media_url: string | null;
      vendor_alarm_id: string | null;
      payload: unknown;
    }>
  >`
    SELECT
      e.event_id::text AS event_id,
      e.video_snippet_url,
      i."mediaUrl" AS media_url,
      i."vendorAlarmId" AS vendor_alarm_id,
      i.payload
    FROM edge_fatigue_events e
    LEFT JOIN "AutonomiseWebhookIngest" i ON i.id = e.source_ingest_id
    WHERE e.event_id::text IN (${Prisma.join(eventIds)})
  `;

  const hydrated = new Map<string, string>();
  for (const row of rows) {
    const ingestClip = row.media_url?.trim();
    if (!ingestClip) continue;

    const clip = resolveReviewMediaUrl(row.payload, row.vendor_alarm_id, ingestClip);
    if (!clip) continue;

    const current = row.video_snippet_url?.trim() ?? "";
    if (current === clip) continue;

    await tx.$executeRaw`
      UPDATE edge_fatigue_events
      SET video_snippet_url = ${clip}
      WHERE event_id = ${row.event_id}::uuid
    `;
    hydrated.set(row.event_id, clip);
  }
  return hydrated;
}
