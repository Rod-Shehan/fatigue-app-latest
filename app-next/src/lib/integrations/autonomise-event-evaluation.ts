import {
  defaultEnabledAlarmIds,
  getCatalogueEntry,
  isVendorAlarmAccepted,
  type FatigueEventPresetId,
} from "@/lib/integrations/fatigue-event-catalogue";

export function evaluateAutonomiseEventAcceptance(
  vendorAlarmId: string | null,
  preset: FatigueEventPresetId
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
  const enabledAlarms = new Set(defaultEnabledAlarmIds(preset));
  if (!isVendorAlarmAccepted(vendorAlarmId, enabledAlarms)) {
    return { accepted: false, rejectReason: "alarm_not_enabled_for_tenant" };
  }
  return { accepted: true, rejectReason: null };
}
