import { describe, expect, it } from "vitest";
import {
  countCompletedChecklistsByType,
  defaultRecordsWeekId,
  formatRecordsChecklistCount,
  formatRecordsWeekOption,
  sheetsForRosterDriver,
  sortRecordsWeeks,
} from "./manager-records";
import { managerSubnavItems } from "./navigation/navigation-links";

describe("sheetsForRosterDriver", () => {
  it("matches roster names case-insensitively", () => {
    const sheets = [
      { id: "1", driver_name: "Alex Driver" },
      { id: "2", driver_name: "Other" },
    ];
    expect(sheetsForRosterDriver(sheets, "alex driver").map((s) => s.id)).toEqual(["1"]);
  });
});

describe("formatRecordsWeekOption", () => {
  it("labels previous weeks with Saturday week ending", () => {
    expect(
      formatRecordsWeekOption({
        weekStarting: "2026-07-26",
        thisWeekSunday: "2026-08-23",
        signed: true,
      })
    ).toBe("Week ending 01/08/2026 · signed");
  });

  it("labels the current week separately", () => {
    expect(
      formatRecordsWeekOption({
        weekStarting: "2026-08-23",
        thisWeekSunday: "2026-08-23",
        signed: false,
      })
    ).toBe("This week · ending 29/08/2026 · unsigned");
  });
});

describe("sortRecordsWeeks / defaultRecordsWeekId", () => {
  it("defaults to the newest previous week", () => {
    const sheets = [
      { id: "current", week_starting: "2026-08-23" },
      { id: "old", week_starting: "2026-08-09" },
      { id: "prev", week_starting: "2026-08-16" },
    ];
    expect(sortRecordsWeeks(sheets, "2026-08-23").map((s) => s.id)).toEqual([
      "prev",
      "old",
      "current",
    ]);
    expect(defaultRecordsWeekId(sheets, "2026-08-23")).toBe("prev");
  });
});

describe("managerSubnavItems", () => {
  it("places Records to the right of Managers for owners", () => {
    const ids = managerSubnavItems(true).map((i) => i.id);
    expect(ids.indexOf("add-managers")).toBeLessThan(ids.indexOf("manager-records"));
    expect(ids.indexOf("manager-records")).toBeLessThan(ids.indexOf("security"));
  });

  it("shows Records to managers who are not owners", () => {
    const ids = managerSubnavItems(false).map((i) => i.id);
    expect(ids).toContain("manager-records");
    expect(ids).not.toContain("add-managers");
    expect(ids).not.toContain("security");
  });
});

describe("countCompletedChecklistsByType", () => {
  it("counts completed records per type and ignores drafts", () => {
    const days = [
      {
        checklists: [
          { status: "completed", type: "ffw" },
          { status: "completed", type: "dimension_load" },
        ],
      },
      {
        checklists: [
          { status: "completed", type: "dimension_load" },
          { status: "draft", type: "prestart" },
        ],
      },
    ];
    expect(countCompletedChecklistsByType(days)).toEqual({
      ffw: 1,
      prestart: 0,
      dimension_load: 2,
    });
  });
});

describe("formatRecordsChecklistCount", () => {
  it("labels empty, one, and many", () => {
    expect(formatRecordsChecklistCount(0)).toBe("No records this week");
    expect(formatRecordsChecklistCount(1)).toBe("1 record");
    expect(formatRecordsChecklistCount(3)).toBe("3 records");
  });
});
