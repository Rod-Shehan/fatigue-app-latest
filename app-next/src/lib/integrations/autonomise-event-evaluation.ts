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
