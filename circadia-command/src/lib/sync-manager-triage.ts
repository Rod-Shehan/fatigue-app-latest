import { randomUUID } from "crypto";
import type { TriageAction } from "@/lib/lifecycle-status";
import type { TxClient } from "@/lib/privileged-db";
import {
  formatFalsePositiveReasonsForNote,
  type FalsePositiveReasonId,
} from "@/lib/false-positive-reasons";

function managerDecisionFromAction(action: TriageAction): "authorized" | "dismissed" {
  return action === "VERIFIED_FALSE_POSITIVE" ? "dismissed" : "authorized";
}

function operatorLabel(fullName: string | null, email: string | null): string {
  if (fullName?.trim()) return `${fullName.trim()} (Command)`;
  if (email?.trim()) return email.trim();
  return "Command operator";
}

/**
 * Write-through to manager CameraAlertTriage when Command completes triage.
 * Idempotent — manager decision wins if already recorded.
 */
export async function syncManagerCameraAlertTriage(
  tx: TxClient,
  args: {
    lifecycleId: string;
    action: TriageAction;
    operatorId: string;
    operatorNotes?: string;
    falsePositiveReasons?: FalsePositiveReasonId[];
  }
): Promise<void> {
  const rows = await tx.$queryRaw<
    Array<{
      source_ingest_id: string | null;
      full_name: string | null;
      email: string | null;
    }>
  >`
    SELECT e.source_ingest_id, co.full_name, co.email
    FROM fatigue_incident_lifecycle l
    INNER JOIN edge_fatigue_events e ON e.event_id = l.event_id
    LEFT JOIN command_operators co ON co.operator_id = l.operator_id
    WHERE l.lifecycle_id = ${args.lifecycleId}::uuid
    LIMIT 1
  `;

  const row = rows[0];
  if (!row?.source_ingest_id) return;

  const decision = managerDecisionFromAction(args.action);
  const decidedByEmail = operatorLabel(row.full_name, row.email);
  const falsePositiveReasons =
    decision === "dismissed" ? (args.falsePositiveReasons ?? []) : [];
  const note =
    decision === "dismissed"
      ? formatFalsePositiveReasonsForNote(falsePositiveReasons, args.operatorNotes)
      : args.operatorNotes?.trim() || null;
  const reasonsJson =
    falsePositiveReasons.length > 0 ? JSON.stringify(falsePositiveReasons) : null;

  await tx.$executeRaw`
    INSERT INTO "CameraAlertTriage" (
      "id",
      "ingestEventId",
      "vendorEventId",
      "decision",
      "note",
      "falsePositiveReasons",
      "decidedByUserId",
      "decidedByEmail",
      "decidedAt"
    ) VALUES (
      ${randomUUID()},
      ${row.source_ingest_id},
      NULL,
      ${decision},
      ${note},
      ${reasonsJson}::jsonb,
      ${`command:${args.operatorId}`},
      ${decidedByEmail},
      NOW()
    )
    ON CONFLICT ("ingestEventId") DO NOTHING
  `;
}
