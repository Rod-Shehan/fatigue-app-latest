import type { TxClient } from "@/lib/privileged-db";
import { hydratePendingEdgeMediaFromIngest } from "@/lib/hydrate-edge-media";
import { hasViewableVideoClip } from "@/lib/video-clip";

export const COMMAND_BULK_DELETE_MAX = 50;

export type DeleteNoVideoResult = {
  deleted: string[];
  skippedHasVideo: string[];
  notFound: string[];
  failed: string[];
};

type IngestRow = {
  id: string;
  kind: string;
  vendorEventId: string | null;
  linkedEventId: string | null;
};

async function deletePairedIngest(tx: TxClient, sourceIngestId: string): Promise<void> {
  const rows = await tx.$queryRaw<IngestRow[]>`
    SELECT id, kind, "vendorEventId", "linkedEventId"
    FROM "AutonomiseWebhookIngest"
    WHERE id = ${sourceIngestId}
  `;
  const row = rows[0];
  if (!row) return;

  const eventKey = row.vendorEventId ?? row.linkedEventId;
  if (row.kind === "event" && eventKey) {
    await tx.$executeRaw`
      DELETE FROM "AutonomiseWebhookIngest"
      WHERE kind = 'media'
        AND (
          "linkedEventId" = ${eventKey}
          OR "vendorEventId" = ${eventKey}
        )
    `;
  }

  await tx.$executeRaw`
    DELETE FROM "CameraAlertTriage" WHERE "ingestEventId" = ${sourceIngestId}
  `;
  await tx.$executeRaw`
    DELETE FROM "AutonomiseWebhookIngest" WHERE id = ${sourceIngestId}
  `;
}

async function deleteOneNoVideoIncident(
  tx: TxClient,
  lifecycleId: string,
  unplayableIds: Set<string>
): Promise<"deleted" | "has_video" | "not_found"> {
  const row = await tx.fatigueIncidentLifecycle.findUnique({
    where: { lifecycleId },
    include: { event: true },
  });
  if (!row || row.eventStatus !== "PENDING_TRIAGE") return "not_found";

  const hydrated = await hydratePendingEdgeMediaFromIngest(tx, [row.eventId]);
  const clip = hydrated.get(row.eventId) ?? row.event.videoSnippetUrl;
  if (hasViewableVideoClip(clip) && !unplayableIds.has(lifecycleId)) return "has_video";

  await tx.$executeRaw`
    DELETE FROM push_dispatch_log WHERE lifecycle_id = ${lifecycleId}::uuid
  `;
  await tx.incidentActionLog.deleteMany({ where: { lifecycleId } });
  await tx.lifecycleTransitionLog.deleteMany({ where: { lifecycleId } });
  await tx.fatigueIncidentLifecycle.delete({ where: { lifecycleId } });
  if (row.event.sourceIngestId) {
    await deletePairedIngest(tx, row.event.sourceIngestId);
  }
  await tx.edgeFatigueEvent.delete({ where: { eventId: row.eventId } });
  return "deleted";
}

export async function deleteNoVideoIncidents(
  tx: TxClient,
  lifecycleIds: readonly string[],
  unplayableIds: readonly string[] = []
): Promise<DeleteNoVideoResult> {
  const uniqueIds = [...new Set(lifecycleIds.map((id) => id.trim()).filter(Boolean))];
  const unplayable = new Set(unplayableIds.map((id) => id.trim()).filter(Boolean));
  const out: DeleteNoVideoResult = {
    deleted: [],
    skippedHasVideo: [],
    notFound: [],
    failed: [],
  };

  for (const lifecycleId of uniqueIds) {
    try {
      const result = await deleteOneNoVideoIncident(tx, lifecycleId, unplayable);
      if (result === "deleted") out.deleted.push(lifecycleId);
      else if (result === "has_video") out.skippedHasVideo.push(lifecycleId);
      else out.notFound.push(lifecycleId);
    } catch {
      out.failed.push(lifecycleId);
    }
  }

  return out;
}
