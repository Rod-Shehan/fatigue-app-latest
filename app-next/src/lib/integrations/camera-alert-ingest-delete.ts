import type { PrismaClient } from "@prisma/client";

/** Pilot/testing only — set CAMERA_ALERTS_ALLOW_DELETE=true on Vercel to enable manager delete. */
export function isCameraAlertDeleteEnabled(): boolean {
  const raw = process.env.CAMERA_ALERTS_ALLOW_DELETE?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export type DeleteCameraAlertResult = {
  deletedIngestIds: string[];
  deletedMediaRows: number;
  deletedTriageRows: number;
};

export type BulkDeleteCameraAlertResult = DeleteCameraAlertResult & {
  notFoundIds: string[];
  failedIds: string[];
};

export const CAMERA_ALERT_BULK_DELETE_MAX = 100;

/**
 * Remove one ingest row from Live alerts testing data.
 * Event rows also drop paired media webhooks and triage audit for that ingest id.
 */
export async function deleteCameraAlertIngest(
  prisma: PrismaClient,
  ingestId: string
): Promise<DeleteCameraAlertResult> {
  const row = await prisma.autonomiseWebhookIngest.findUnique({
    where: { id: ingestId },
    select: { id: true, kind: true, vendorEventId: true, linkedEventId: true },
  });

  if (!row) {
    throw new Error("NOT_FOUND");
  }

  const eventKey = row.vendorEventId ?? row.linkedEventId;
  let deletedMediaRows = 0;

  if (row.kind === "event" && eventKey) {
    const mediaDelete = await prisma.autonomiseWebhookIngest.deleteMany({
      where: {
        kind: "media",
        OR: [{ linkedEventId: eventKey }, { vendorEventId: eventKey }],
      },
    });
    deletedMediaRows = mediaDelete.count;
  }

  const triageDelete = await prisma.cameraAlertTriage.deleteMany({
    where: { ingestEventId: ingestId },
  });

  await prisma.autonomiseWebhookIngest.delete({ where: { id: ingestId } });

  return {
    deletedIngestIds: [ingestId],
    deletedMediaRows,
    deletedTriageRows: triageDelete.count,
  };
}

/** Remove many ingest rows (testing cleanup). Skips missing ids; continues on individual failures. */
export async function deleteCameraAlertIngestBatch(
  prisma: PrismaClient,
  ingestIds: readonly string[]
): Promise<BulkDeleteCameraAlertResult> {
  const uniqueIds = [...new Set(ingestIds.map((id) => id.trim()).filter(Boolean))];
  const out: BulkDeleteCameraAlertResult = {
    deletedIngestIds: [],
    deletedMediaRows: 0,
    deletedTriageRows: 0,
    notFoundIds: [],
    failedIds: [],
  };

  for (const ingestId of uniqueIds) {
    try {
      const result = await deleteCameraAlertIngest(prisma, ingestId);
      out.deletedIngestIds.push(...result.deletedIngestIds);
      out.deletedMediaRows += result.deletedMediaRows;
      out.deletedTriageRows += result.deletedTriageRows;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "DELETE_FAILED";
      if (msg === "NOT_FOUND") {
        out.notFoundIds.push(ingestId);
      } else {
        out.failedIds.push(ingestId);
      }
    }
  }

  return out;
}
