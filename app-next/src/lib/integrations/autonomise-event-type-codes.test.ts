import { afterEach, describe, expect, it } from "vitest";
import {
  AUTONOMISE_DEFAULT_EVENT_TYPE_TO_ALARM,
  getAutonomiseEventTypeCodeMap,
  resolveVendorAlarmFromEventTypeCodes,
} from "@/lib/integrations/autonomise-event-type-codes";
import { getCatalogueEntry } from "@/lib/integrations/fatigue-event-catalogue";

describe("autonomise-event-type-codes", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("maps core_plus_adas catalogue codes from Autonomise enum", () => {
    expect(resolveVendorAlarmFromEventTypeCodes([18])).toBe("VT3600AI_ALARM_DSM_Fatigue");
    expect(resolveVendorAlarmFromEventTypeCodes([20])).toBe("VT3600AI_ALARM_DSM_Distracted");
    expect(resolveVendorAlarmFromEventTypeCodes([22])).toBe("VT3600AI_ALARM_ADAS_LaneDeparture");
    expect(resolveVendorAlarmFromEventTypeCodes([23])).toBe(
      "VT3600AI_ALARM_ADAS_ForwardCollisionWarning"
    );
    expect(resolveVendorAlarmFromEventTypeCodes([28])).toBe(
      "VT3600AI_ALARM_ADAS_FollowingDistanceWarning"
    );
  });

  it("keeps legacy MTS fatigue code 2", () => {
    expect(resolveVendorAlarmFromEventTypeCodes([2])).toBe("VT3600AI_ALARM_DSM_Fatigue");
  });

  it("maps excluded alarms for ingest rejection (not unknown)", () => {
    expect(resolveVendorAlarmFromEventTypeCodes([19])).toBe("VT3600AI_ALARM_DSM_Smoking");
    expect(resolveVendorAlarmFromEventTypeCodes([29])).toBe("VT3600AI_ALARM_DSM_SeatbeltUnfastened");
  });

  it("merges AUTONOMISE_FATIGUE_EVENT_TYPE_CODES env aliases", () => {
    process.env.AUTONOMISE_FATIGUE_EVENT_TYPE_CODES = "99";
    expect(getAutonomiseEventTypeCodeMap()[99]).toBe("VT3600AI_ALARM_DSM_Fatigue");
  });

  it("applies AUTONOMISE_EVENT_TYPE_CODE_MAP JSON overrides", () => {
    process.env.AUTONOMISE_EVENT_TYPE_CODE_MAP = JSON.stringify({
      22: "VT3600AI_ALARM_ADAS_ForwardCollisionWarning",
    });
    expect(resolveVendorAlarmFromEventTypeCodes([22])).toBe(
      "VT3600AI_ALARM_ADAS_ForwardCollisionWarning"
    );
  });

  it("covers every default mapped code with a catalogue entry", () => {
    for (const alarmId of Object.values(AUTONOMISE_DEFAULT_EVENT_TYPE_TO_ALARM)) {
      expect(getCatalogueEntry(alarmId)?.vendorAlarmId).toBe(alarmId);
    }
  });
});
