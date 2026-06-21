import { describe, expect, it } from "vitest";
import {
  AUTONOMISE_VT3600AI_CATALOGUE,
  catalogueEntriesOfferedToTenant,
  defaultEnabledAlarmIds,
  isVendorAlarmAccepted,
} from "@/lib/integrations/fatigue-event-catalogue";

describe("fatigue-event-catalogue", () => {
  it("excludes seatbelt and smoking from tenant-offered list", () => {
    const ids = catalogueEntriesOfferedToTenant().map((e) => e.vendorAlarmId);
    expect(ids).not.toContain("VT3600AI_ALARM_DSM_SeatbeltUnfastened");
    expect(ids).not.toContain("VT3600AI_ALARM_DSM_Smoking");
  });

  it("core_only preset enables DSM fatigue and distraction", () => {
    const ids = defaultEnabledAlarmIds("core_only");
    expect(ids).toContain("VT3600AI_ALARM_DSM_Fatigue");
    expect(ids).toContain("VT3600AI_ALARM_DSM_Distracted");
    expect(ids).not.toContain("VT3600AI_ALARM_ADAS_LaneDeparture");
  });

  it("core_plus_adas includes lane departure by default", () => {
    const ids = defaultEnabledAlarmIds("core_plus_adas");
    expect(ids).toContain("VT3600AI_ALARM_ADAS_LaneDeparture");
  });

  it("rejects excluded alarms even if mistakenly enabled", () => {
    const enabled = new Set(["VT3600AI_ALARM_DSM_SeatbeltUnfastened"]);
    expect(isVendorAlarmAccepted("VT3600AI_ALARM_DSM_SeatbeltUnfastened", enabled)).toBe(false);
  });

  it("accepts enabled core alarm", () => {
    const enabled = new Set(defaultEnabledAlarmIds("core_only"));
    expect(isVendorAlarmAccepted("VT3600AI_ALARM_DSM_Fatigue", enabled)).toBe(true);
  });

  it("catalogue ids are unique", () => {
    const ids = AUTONOMISE_VT3600AI_CATALOGUE.map((e) => e.vendorAlarmId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
