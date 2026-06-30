/**
 * Manager → Command lifecycle sync (shared queue §3.5).
 */

import type { PrismaClient } from "@prisma/client";
import type { CameraAlertTriageDecision } from "@/lib/integrations/camera-alert-triage";
import {
  applyManagerDismissFromPending,
  applyManagerVerifiedResolutionFromPending,
  listPendingLifecycleIdsForIngest,
  type ManagerLifecycleCompleteResult,
} from "@/lib/integrations/incident-lifecycle-transition";

export type { ManagerLifecycleCompleteResult as ManagerLifecycleSyncResult };

/** Close Command lifecycle row(s) after manager triage. */
export async function syncCommandLifecycleFromManagerTriage(
  prisma: PrismaClient,
  args: {
    ingestEventId: string;
    decision: CameraAlertTriageDecision;
    note?: string | null;
    decidedByUserId: string;
    resolutionActionType?: string;
  }
): Promise<ManagerLifecycleCompleteResult> {
  if (args.decision === "dismissed") {
    return applyManagerDismissFromPending(prisma, {
      ingestEventId: args.ingestEventId,
      actorId: args.decidedByUserId,
      note: args.note,
      idempotencyKey: `manager_triage_${args.ingestEventId}`,
    });
  }

  const auditNote = args.note?.trim() || "Verified fatigue — action recorded";
  return applyManagerVerifiedResolutionFromPending(prisma, {
    ingestEventId: args.ingestEventId,
    actorId: args.decidedByUserId,
    auditNote,
    resolutionActionType: args.resolutionActionType ?? "other_outcome",
    idempotencyKey: `manager_triage_${args.ingestEventId}`,
  });
}

/** Backfill lifecycle rows still pending after manager triage (pre-sync era). */
export async function reconcileStalePendingLifecycleFromManagerTriage(
  prisma: PrismaClient
): Promise<number> {
  const rows = await prisma.$queryRaw<
    Array<{
      ingest_event_id: string;
      decision: string;
      note: string | null;
      decided_by_user_id: string;
    }>
  >`
    SELECT DISTINCT ON (t."ingestEventId")
      t."ingestEventId" AS ingest_event_id,
      t.decision,
      t.note,
      t."decidedByUserId" AS decided_by_user_id
    FROM "CameraAlertTriage" t
    INNER JOIN edge_fatigue_events e ON (
      t."ingestEventId" = e.source_ingest_id
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
    INNER JOIN fatigue_incident_lifecycle l ON l.event_id = e.event_id
    WHERE l.event_status = 'PENDING_TRIAGE'
      AND t.decision IN ('authorized', 'dismissed')
    ORDER BY t."ingestEventId", t."decidedAt" DESC
  `;

  let updated = 0;
  for (const row of rows) {
    const pendingIds = await listPendingLifecycleIdsForIngest(prisma, row.ingest_event_id);
    if (pendingIds.length === 0) continue;

    const result = await syncCommandLifecycleFromManagerTriage(prisma, {
      ingestEventId: row.ingest_event_id,
      decision: row.decision as CameraAlertTriageDecision,
      note: row.note,
      decidedByUserId: row.decided_by_user_id,
      resolutionActionType: row.decision === "authorized" ? "other_outcome" : undefined,
    });
    updated += result.updatedCount;
  }
  return updated;
}
