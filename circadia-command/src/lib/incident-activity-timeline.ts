/**
 * Incident activity timeline — transitions + resolution actions (§3.5 Phase 2).
 */

import type { PrismaClient } from "@prisma/client";
import { isIncidentResolutionActionType, resolutionActionLabel } from "@/lib/triage-resolution";

export type IncidentActivityEntry = {
  at: string;
  label: string;
  detail?: string | null;
  kind: "detected" | "claim" | "transition" | "action";
};

type TransitionRow = {
  transition_timestamp: Date;
  from_status: string;
  to_status: string;
  actor_type: string;
  transition_payload_snapshot: unknown;
};

type ActionRow = {
  createdAt: Date;
  actionType: string;
  actorLabel: string | null;
  actorType: string;
};

function payloadAction(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const action = (snapshot as Record<string, unknown>).action;
  return typeof action === "string" ? action : null;
}

function formatActorType(actorType: string): string {
  if (actorType === "FLEET_MANAGER") return "Manager";
  if (actorType === "OPERATOR") return "Command";
  if (actorType === "SYSTEM") return "System";
  return actorType.replace(/_/g, " ");
}

function transitionLabel(row: TransitionRow): string {
  const action = payloadAction(row.transition_payload_snapshot);
  if (action === "claimed") return "Claimed";
  if (action === "claim_released") return "Claim released";
  if (row.to_status === "VERIFIED_FALSE_POSITIVE") return "Dismissed as false positive";
  if (row.to_status === "VERIFIED_TRUE_FATIGUE") return "Verified fatigue";
  if (row.to_status === "CLOSED") return "Closed";
  if (row.to_status === "INTERVENTION_SENT") return "Intervention recorded";
  return `${row.from_status} → ${row.to_status}`;
}

export async function fetchIncidentActivityTimeline(
  prisma: PrismaClient,
  lifecycleId: string
): Promise<IncidentActivityEntry[]> {
  const detectedRows = await prisma.$queryRaw<Array<{ detected_at: Date }>>`
    SELECT detected_at FROM fatigue_incident_lifecycle
    WHERE lifecycle_id = ${lifecycleId}::uuid
    LIMIT 1
  `;
  const detectedAt = detectedRows[0]?.detected_at ?? null;

  const [transitions, actions] = await Promise.all([
    prisma.$queryRaw<TransitionRow[]>`
      SELECT transition_timestamp, from_status, to_status, actor_type, transition_payload_snapshot
      FROM lifecycle_transition_log
      WHERE lifecycle_id = ${lifecycleId}::uuid
      ORDER BY transition_timestamp ASC
    `,
    prisma.$queryRaw<ActionRow[]>`
      SELECT "createdAt", "actionType", "actorLabel", "actorType"
      FROM "IncidentActionLog"
      WHERE "lifecycleId" = ${lifecycleId}::uuid
      ORDER BY "createdAt" ASC
    `,
  ]);

  const entries: IncidentActivityEntry[] = [];
  if (detectedAt) {
    entries.push({ at: detectedAt.toISOString(), label: "Event detected", kind: "detected" });
  }
  for (const row of transitions) {
    const action = payloadAction(row.transition_payload_snapshot);
    const kind = action === "claimed" || action === "claim_released" ? "claim" : "transition";
    entries.push({
      at: row.transition_timestamp.toISOString(),
      label: transitionLabel(row),
      detail: formatActorType(row.actor_type),
      kind,
    });
  }
  for (const row of actions) {
    const actionLabel = isIncidentResolutionActionType(row.actionType)
      ? resolutionActionLabel(row.actionType)
      : row.actionType.replace(/_/g, " ");
    entries.push({
      at: row.createdAt.toISOString(),
      label: `Action: ${actionLabel}`,
      detail: row.actorLabel ?? formatActorType(row.actorType),
      kind: "action",
    });
  }
  entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return entries;
}
