import type { PrismaClient } from "@prisma/client";
import type { AutonomiseExtractedFields } from "@/lib/integrations/autonomise-payload";
import {
  getCatalogueEntry,
  isVendorAlarmAccepted,
} from "@/lib/integrations/fatigue-event-catalogue";

export function evaluateAutonomiseEventAcceptance(
  vendorAlarmId: string | null,
  enabledAlarmIds: ReadonlySet<string>
): { accepted: boolean; rejectReason: string | null } {
  if (!vendorAlarmId) {
    return { accepted: false, rejectReason: "missing_alarm_id" };
  }
  const entry = getCatalogueEntry(vendorAlarmId);
  if (!entry) {
    return { accepted: false, rejectReason: "unknown_alarm_id" };
  }
  if (entry.tier === "excluded" || entry.pipeline === null) {
    return { accepted: false, rejectReason: "excluded_alarm" };
  }
  if (!isVendorAlarmAccepted(vendorAlarmId, enabledAlarmIds)) {
    return { accepted: false, rejectReason: "alarm_not_enabled_for_tenant" };
  }
  return { accepted: true, rejectReason: null };
}

/** Media is stored only when its event type is accepted (or a stored accepted event row exists). */
export async function evaluateAutonomiseMediaAcceptance(
  prisma: PrismaClient,
  fields: Pick<AutonomiseExtractedFields, "vendorAlarmId" | "linkedEventId" | "vendorEventId">,
  enabledAlarmIds: ReadonlySet<string>
): Promise<{ accepted: boolean; rejectReason: string | null }> {
  if (fields.vendorAlarmId) {
    return evaluateAutonomiseEventAcceptance(fields.vendorAlarmId, enabledAlarmIds);
  }

  const eventKey = fields.linkedEventId ?? fields.vendorEventId;
  if (!eventKey) {
    return { accepted: false, rejectReason: "missing_event_link" };
  }

  const eventRow = await prisma.autonomiseWebhookIngest.findFirst({
    where: {
      kind: "event",
      OR: [{ vendorEventId: eventKey }, { linkedEventId: eventKey }],
    },
    orderBy: { receivedAt: "desc" },
    select: { accepted: true, vendorAlarmId: true, rejectReason: true },
  });

  if (!eventRow) {
    return { accepted: false, rejectReason: "event_webhook_pending" };
  }

  if (!eventRow.accepted) {
    return {
      accepted: false,
      rejectReason: eventRow.rejectReason ?? "linked_event_not_accepted",
    };
  }

  return evaluateAutonomiseEventAcceptance(eventRow.vendorAlarmId, enabledAlarmIds);
}
