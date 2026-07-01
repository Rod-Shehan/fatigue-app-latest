/**
 * Resolve manager Live alerts URL id → lifecycle + ingest (queue cards use lifecycle id).
 */

import type { PrismaClient } from "@prisma/client";
import { commandPilotTenantIdUuid } from "@/lib/integrations/command-lifecycle-bridge-config";
import { resolveLifecycleIdForIngest } from "@/lib/integrations/incident-claim";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ManagerAlertTarget = {
  lifecycleId: string | null;
  ingestEventId: string | null;
};

export async function resolveManagerAlertTarget(
  prisma: PrismaClient,
  id: string
): Promise<ManagerAlertTarget | null> {
  const raw = id.startsWith("lifecycle:") ? id.slice("lifecycle:".length) : id;

  if (UUID_RE.test(raw)) {
    const rows = await prisma.$queryRaw<
      Array<{ lifecycle_id: string; source_ingest_id: string | null }>
    >`
      SELECT
        l.lifecycle_id::text AS lifecycle_id,
        e.source_ingest_id
      FROM fatigue_incident_lifecycle l
      INNER JOIN edge_fatigue_events e ON e.event_id = l.event_id
      WHERE l.lifecycle_id = ${raw}::uuid
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return { lifecycleId: row.lifecycle_id, ingestEventId: row.source_ingest_id };
  }

  const lifecycleId = await resolveLifecycleIdForIngest(prisma, raw);
  const ingest = await prisma.autonomiseWebhookIngest.findUnique({
    where: { id: raw },
    select: { id: true },
  });
  if (!ingest && !lifecycleId) return null;
  return { lifecycleId, ingestEventId: ingest ? raw : null };
}

/** Scope queue to pilot tenant Autonomise bridge rows (matches Command desk). */
export function pilotTenantIdForQueue(): string | null {
  return commandPilotTenantIdUuid();
}
