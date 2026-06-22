import { describe, expect, it } from "vitest";
import {
  buildEventSettingsSnapshot,
  enabledAlarmIdsForPreset,
  normalizeEnabledAlarmIds,
} from "@/lib/integrations/camera-alert-event-settings";

describe("camera-alert-event-settings", () => {
  it("normalizes to offered catalogue ids only", () => {
    const ids = normalizeEnabledAlarmIds([
      "VT3600AI_ALARM_DSM_Fatigue",
      "VT3600AI_ALARM_DSM_SeatbeltUnfastened",
      "VT3600AI_ALARM_DSM_Fatigue",
    ]);
    expect(ids).toEqual(["VT3600AI_ALARM_DSM_Fatigue"]);
  });

  it("builds snapshot with per-entry enabled flags", () => {
    const snapshot = buildEventSettingsSnapshot(["VT3600AI_ALARM_DSM_Fatigue"]);
    const fatigue = snapshot.entries.find((e) => e.vendorAlarmId === "VT3600AI_ALARM_DSM_Fatigue");
    const lane = snapshot.entries.find((e) => e.vendorAlarmId === "VT3600AI_ALARM_ADAS_LaneDeparture");
    expect(fatigue?.enabled).toBe(true);
    expect(lane?.enabled).toBe(false);
  });

  it("core_only preset excludes ADAS", () => {
    const ids = enabledAlarmIdsForPreset("core_only");
    expect(ids).toContain("VT3600AI_ALARM_DSM_Fatigue");
    expect(ids).not.toContain("VT3600AI_ALARM_ADAS_LaneDeparture");
  });
});
