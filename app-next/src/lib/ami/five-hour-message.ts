/**
 * Driver/owner copy for AMI 5h rest flags. Does not change scoring.
 */

import { getTodayYmdInTimeZone, getSheetDayDateString } from "@/lib/weeks";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WA_TZ = "Australia/Perth";

export function formatClockHm(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: WA_TZ,
  });
}

export function formatWeekdayDate(ms: number): string {
  const d = new Date(ms);
  const weekday = new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    timeZone: WA_TZ,
  }).format(d);
  const day = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    timeZone: WA_TZ,
  }).format(d);
  const month = new Intl.DateTimeFormat("en-AU", {
    month: "short",
    timeZone: WA_TZ,
  }).format(d);
  return `${weekday} ${day} ${month}`;
}

export function formatWorkHoursFromMinutes(mins: number): string {
  const h = Math.round((mins / 60) * 10) / 10;
  return `${h}h`;
}

/** What was short vs 20 min / 2×10, using rest runs already scored. */
export function formatFiveHourRestDetail(restRunMinutes: number[]): string {
  const runs = restRunMinutes.filter((d) => d > 0).sort((a, b) => b - a);
  const longest = runs[0] ?? 0;
  const qualifying = runs.filter((d) => d >= 10);

  if (longest < 10) {
    if (longest === 0) {
      return "Last 5h work had no rest of 10 min or more.";
    }
    return `Longest rest in that block: ${longest} min (need 20 min continuous, or two 10 min rests).`;
  }
  if (qualifying.length === 1 && qualifying[0]! < 20) {
    return `Longest rest in that block: ${qualifying[0]} min (need one more 10 min, or 20 min continuous).`;
  }
  if (qualifying.every((d) => d < 20)) {
    const listed = qualifying.map((d) => `${d} min`).join(" + ");
    return `Rests in that block: ${listed} (need 20 min continuous, or two 10 min rests).`;
  }
  return `Longest rest in that block: ${longest} min (need 20 min continuous, or two 10 min rests).`;
}

export function formatFiveHourViolationMessage(input: {
  workMinutesInWindow: number;
  restRunMinutes: number[];
  lastWorkMs: number;
  windowStartMs: number;
}): string {
  const workH = formatWorkHoursFromMinutes(input.workMinutesInWindow);
  const time = formatClockHm(input.lastWorkMs);
  const rest = formatFiveHourRestDetail(input.restRunMinutes);
  const startYmd = getTodayYmdInTimeZone(WA_TZ, new Date(input.windowStartMs));
  const endYmd = getTodayYmdInTimeZone(WA_TZ, new Date(input.lastWorkMs));
  const fromClause =
    startYmd !== endYmd
      ? ` From ${formatWeekdayDate(input.windowStartMs)}, ${formatClockHm(input.windowStartMs)}.`
      : "";
  return `20 min rest per 5h work not met (${time}). Last 5h work (${workH}). ${rest}${fromClause}`;
}

/** Weekday for the week sheet + scroll target. Date string if last work is not on this week. */
export function fiveHourViolationDayAttribution(
  lastWorkMs: number,
  weekStarting?: string
): { day: string; scrollDayIndex?: number } {
  if (!weekStarting) {
    return { day: formatWeekdayDate(lastWorkMs) };
  }
  const ymd = getTodayYmdInTimeZone(WA_TZ, new Date(lastWorkMs));
  for (let i = 0; i < 7; i++) {
    if (getSheetDayDateString(weekStarting, i) === ymd) {
      return { day: DAY_LABELS[i], scrollDayIndex: i };
    }
  }
  return { day: formatWeekdayDate(lastWorkMs) };
}
