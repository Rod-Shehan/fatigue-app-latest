import { describe, it, expect } from "vitest";
import { WORKSAFE_TRACK_LABELS } from "./types";
import { paintForPdfDay, renderWorkSafeDaySheetHtml } from "./pdf-render";
import { dominantTrackInQuarter, WORKSAFE_HOUR_LABELS } from "./quarter-grid";
import { MINUTES_PER_DAY } from "@/lib/coverage/derive-minute-coverage";

describe("WorkSafe PDF day tile", () => {
  it("renders paper header, hour labels, and filled quarter cells", () => {
    const dateStr = "2099-06-01";
    const work_time = Array(MINUTES_PER_DAY).fill(false);
    const breaks = Array(MINUTES_PER_DAY).fill(false);
    const non_work = Array(MINUTES_PER_DAY).fill(false);
    for (let m = 8 * 60; m < 12 * 60; m++) work_time[m] = true;
    for (let m = 12 * 60; m < 12 * 60 + 20; m++) breaks[m] = true;
    for (let m = 12 * 60 + 20; m < 16 * 60; m++) work_time[m] = true;
    for (let m = 16 * 60; m < MINUTES_PER_DAY; m++) non_work[m] = true;

    const paint = paintForPdfDay(
      { work_time, breaks, non_work, start_kms: 1000, start_location: "Perth", destination: "Kal", end_kms: 1400 },
      dateStr,
      "2099-12-31",
      MINUTES_PER_DAY
    );
    const html = renderWorkSafeDaySheetHtml({
      paint,
      dayName: "Monday",
      dateLabel: "01/06/2099",
      day: {
        start_kms: 1000,
        start_location: "Perth",
        destination: "Kal",
        end_kms: 1400,
      },
    });

    expect(html).toContain("Odometer Start");
    expect(html).toContain("Start Location");
    expect(html).toContain("Finish Location");
    expect(html).toContain("Odometer Finish");
    expect(html).toContain("Truck Reg");
    expect(html).toContain("MONDAY");
    expect(html).toContain("01/06/2099");
    expect(html).toContain("1.00");
    expect(html).not.toContain("24.00");
    expect(html).toContain(WORKSAFE_TRACK_LABELS.work);
    expect(html).toContain("<path d=");
    expect(html).toContain("Perth");
    expect(dominantTrackInQuarter(paint.trackByMinute, (12 * 60) / 15)).toBe("break");
    expect(WORKSAFE_HOUR_LABELS[0]).toBe("");
  });
});
