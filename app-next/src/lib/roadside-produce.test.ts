import { describe, expect, it } from "vitest";
import {
  getRoadsideProduceFromYmd,
  selectSheetsForRoadsideProduce,
  weekOverlapsProduceWindow,
} from "@/lib/roadside-produce";

describe("roadside produce window", () => {
  it("getRoadsideProduceFromYmd spans 28 inclusive days", () => {
    expect(getRoadsideProduceFromYmd("2026-06-02", 28)).toBe("2026-05-06");
  });

  it("weekOverlapsProduceWindow matches days in range", () => {
    expect(weekOverlapsProduceWindow("2026-05-04", "2026-05-06", "2026-06-02")).toBe(true);
    expect(weekOverlapsProduceWindow("2026-03-30", "2026-05-06", "2026-06-02")).toBe(false);
  });

  it("selectSheetsForRoadsideProduce sorts ascending by week", () => {
    const sheets = [
      { id: "b", weekStarting: "2026-05-18" },
      { id: "a", weekStarting: "2026-05-04" },
      { id: "c", weekStarting: "2026-04-20" },
    ];
    const picked = selectSheetsForRoadsideProduce(sheets, "2026-05-06", "2026-06-02");
    expect(picked.map((s) => s.id)).toEqual(["a", "b"]);
  });
});
