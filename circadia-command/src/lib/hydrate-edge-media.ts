import { Prisma } from "@prisma/client";
import type { TxClient } from "@/lib/privileged-db";

function needsIngestClip(edgeUrl: string | null | undefined, ingestClip: string): boolean {
  if (!ingestClip) return false;
  const current = edgeUrl?.trim() ?? "";
  if (!current || current.startsWith("pending://")) return true;
  return current !== ingestClip;
}

/**
 * Copy clips from AutonomiseWebhookIngest onto edge_fatigue_events when Command
 * still has a pending:// placeholder (manager inbox may already have the URL).
 */
export async function hydratePendingEdgeMediaFromIngest(
  tx: TxClient,
  eventIds: string[]
): Promise<Map<string, string>> {
  if (eventIds.length === 0) return new Map();

  const rows = await tx.$queryRaw<
    Array<{ event_id: string; video_snippet_url: string; media_url: string | null }>
  >`
    SELECT
      e.event_id::text AS event_id,
      e.video_snippet_url,
      i."mediaUrl" AS media_url
    FROM edge_fatigue_events e
    LEFT JOIN "AutonomiseWebhookIngest" i ON i.id = e.source_ingest_id
    WHERE e.event_id::text IN (${Prisma.join(eventIds)})
  `;

  const hydrated = new Map<string, string>();
  for (const row of rows) {
    const ingestClip = row.media_url?.trim();
    if (!ingestClip || !needsIngestClip(row.video_snippet_url, ingestClip)) continue;

    await tx.$executeRaw`
      UPDATE edge_fatigue_events
      SET video_snippet_url = ${ingestClip}
      WHERE event_id = ${row.event_id}::uuid
    `;
    hydrated.set(row.event_id, ingestClip);
  }
  return hydrated;
}
