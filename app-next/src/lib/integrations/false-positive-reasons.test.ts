import { describe, expect, it } from "vitest";
import {
  buildFalsePositiveExportCsv,
  falsePositiveExportRowToCells,
} from "@/lib/integrations/false-positive-export";
import {
  formatFalsePositiveReasonsForNote,
  normalizeFalsePositiveReasons,
  requireFalsePositiveReasonsForDismiss,
} from "@/lib/integrations/false-positive-reasons";

describe("false-positive-reasons", () => {
  it("requires at least one reason when dismissed", () => {
    expect(() => requireFalsePositiveReasonsForDismiss("dismissed", [])).toThrow(
      "FALSE_POSITIVE_REASONS_REQUIRED"
    );
    expect(requireFalsePositiveReasonsForDismiss("dismissed", ["driver_looking_left"])).toEqual([
      "driver_looking_left",
    ]);
    expect(requireFalsePositiveReasonsForDismiss("authorized", [])).toEqual([]);
  });

  it("normalises and dedupes reason ids", () => {
    expect(
      normalizeFalsePositiveReasons([
        "driver_looking_right",
        "invalid",
        "driver_looking_right",
        "undetermined",
      ])
    ).toEqual(["driver_looking_right", "undetermined"]);
  });

  it("formats note with trigger labels", () => {
    expect(
      formatFalsePositiveReasonsForNote(["driver_looking_down"], "mirror check")
    ).toBe("Trigger: Driver looking down — mirror check");
  });
});

describe("false-positive-export", () => {
  it("emits stable Y/N columns for spreadsheet import", () => {
    const cells = falsePositiveExportRowToCells({
      ingestEventId: "ing-1",
      vendorEventId: "ven-1",
      alertType: "Distraction",
      vehicleRego: "1ABC123",
      driverName: "Alex",
      detectedAt: "2026-07-01T08:36:00.000Z",
      receivedAt: "2026-07-01T08:37:00.000Z",
      decidedAt: "2026-07-01T09:00:00.000Z",
      decidedBy: "manager@example.com",
      note: "Trigger: Driver looking left",
      reasons: ["driver_looking_left"],
    });

    expect(cells[0]).toBe("ing-1");
    expect(cells[10]).toBe("Y");
    expect(cells[11]).toBe("N");
    expect(cells[14]).toBe("N");
    expect(cells[15]).toBe("N");
  });

  it("includes UTF-8 BOM and header row", () => {
    const csv = buildFalsePositiveExportCsv([]);
    expect(csv.startsWith("\uFEFFingest_event_id")).toBe(true);
    expect(csv).toContain("driver looking left");
    expect(csv).toContain("hand over face");
    expect(csv).toContain("mobile phone use");
    expect(csv).toContain("undetermined");
  });
});
