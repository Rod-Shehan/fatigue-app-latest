import { describe, it, expect } from "vitest";
import { WORKSAFE_TRACK_LABELS } from "./types";
import { paintForPdfDay, renderWorkSafeDaySheetHtml } from "./pdf-render";
import { MINUTES_PER_DAY } from "@/lib/coverage/derive-minute-coverage";

describe("WorkSafe PDF day tile", () => {
  it("renders WorkSafe labels and a step path for a known day", () => {
    const dateStr = "2099-06-01";
    const work_time = Array(MINUTES_PER_DAY).fill(false);
    const breaks = Array(MINUTES_PER_DAY).fill(false);
    const non_work = Array(MINUTES_PER_DAY).fill(false);
    for (let m = 8 * 60; m < 12 * 60; m++) work_time[m] = true;
    for (let m = 12 * 60; m < 12 * 60 + 20; m++) breaks[m] = true;
    for (let m = 12 * 60 + 20; m < 16 * 60; m++) work_time[m] = true;
    for (let m = 16 * 60; m < MINUTES_PER_DAY; m++) non_work[m] = true;

    const paint = paintForPdfDay(
      { work_time, breaks, non_work },
      dateStr,
      "2099-12-31",
      MINUTES_PER_DAY
    );
    const html = renderWorkSafeDaySheetHtml({
      paint,
      dayName: "Monday",
      dateLabel: "01/06/2099",
      driverName: "Test Driver",
      day: { truck_rego: "1ABC123" },
    });

    expect(html).toContain(WORKSAFE_TRACK_LABELS.work);
    expect(html).toContain(WORKSAFE_TRACK_LABELS.break);
    expect(html).toContain(WORKSAFE_TRACK_LABELS.non_work);
    expect(html).toContain("<path d=");
    expect(html).toContain("1ABC123");
    expect(paint.totalsMinutes.break).toBe(20);
  });
});
