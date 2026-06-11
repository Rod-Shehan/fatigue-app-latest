import type { DayData } from "@/lib/api";
import { getHours } from "@/lib/compliance";
import { formatHoursStatistic } from "@/lib/hours";
import { formatSheetDisplayDate, getSheetDayDateString } from "@/lib/weeks";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function summarizeDayIndices(
  days: DayData[],
  indices: number[],
  variant: "past" | "future"
): string {
  if (indices.length === 0) return "";
  if (variant === "future") {
    const planned = indices.filter((i) => {
      const d = days[i];
      if (!d) return false;
      return (
        (d.start_location ?? "").trim() !== "" ||
        (d.destination ?? "").trim() !== "" ||
        (d.truck_rego ?? "").trim() !== "" ||
        d.start_kms != null
      );
    }).length;
    if (planned > 0) return `${planned} planned`;
    return indices.length === 1 ? "Upcoming" : `${indices.length} days upcoming`;
  }

  let workHours = 0;
  let activeDays = 0;
  for (const i of indices) {
    const d = days[i];
    const wh = getHours(d?.work_time);
    workHours += wh;
    if (wh > 0 || (d?.events?.length ?? 0) > 0) activeDays++;
  }
  if (activeDays === 0) return "No activity";
  if (workHours > 0) return `${formatHoursStatistic(workHours)}h work`;
  return "Logged";
}

export function dayIndexRangeLabels(
  weekStart: string,
  indices: number[],
  variant: "past" | "future"
): { title: string; subtitle: string } {
  if (indices.length === 0) {
    return { title: "", subtitle: "" };
  }
  const first = indices[0]!;
  const last = indices[indices.length - 1]!;
  const title = variant === "past" ? "Earlier this week" : "Later this week";
  if (indices.length === 1) {
    return {
      title,
      subtitle: `${DAY_NAMES[first]} · ${formatSheetDisplayDate(getSheetDayDateString(weekStart, first))}`,
    };
  }
  const firstYmd = getSheetDayDateString(weekStart, first);
  const lastYmd = getSheetDayDateString(weekStart, last);
  const firstLabel = formatSheetDisplayDate(firstYmd);
  const lastLabel = formatSheetDisplayDate(lastYmd);
  const subtitle =
    firstLabel === lastLabel
      ? `${DAY_NAMES[first]} – ${DAY_NAMES[last]} · ${firstLabel}`
      : `${DAY_NAMES[first]} – ${DAY_NAMES[last]} · ${firstLabel} – ${lastLabel}`;
  return { title, subtitle };
}
