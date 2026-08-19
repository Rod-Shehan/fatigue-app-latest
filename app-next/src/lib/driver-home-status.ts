import { getSheetOwnerEventsInOrder } from "@/lib/rolling-events";
import { getSheetDayDateString } from "@/lib/weeks";
import type { DayData } from "@/lib/api";

export type DriverShiftActivity = "idle" | "work" | "break" | "other_work" | "stopped";

export type DriverHomeShiftStatus = {
  activity: DriverShiftActivity;
  headline: string;
  detail?: string;
};

function formatElapsedMinutes(totalMinutes: number): string {
  const m = Math.floor(Math.max(0, totalMinutes));
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0) return `${h}h ${min.toString().padStart(2, "0")}m`;
  return `${min}m`;
}

/** Current shift state for drive home (solo; uses all events on the sheet timeline). */
export function getDriverHomeShiftStatus(
  days: DayData[],
  currentDayIndex: number,
  weekStarting: string,
  todayYmd: string,
  nowMs: number = Date.now()
): DriverHomeShiftStatus {
  const sheetDayYmd = weekStarting ? getSheetDayDateString(weekStarting, currentDayIndex) : todayYmd;
  if (sheetDayYmd !== todayYmd) {
    return {
      activity: "idle",
      headline: "Not on shift today",
      detail: "Open this week to review or log when you start.",
    };
  }

  const events = getSheetOwnerEventsInOrder(days);
  const last = events.length ? events[events.length - 1] : undefined;
  if (!last) {
    return {
      activity: "idle",
      headline: "Ready to start shift",
      detail: "Tap Open this week to log work or start your shift",
    };
  }

  if (last.type === "stop") {
    return {
      activity: "stopped",
      headline: "Previous shift ended",
      detail: "You can continue your next shift this week.",
    };
  }

  const elapsedMin = Math.floor((nowMs - new Date(last.time).getTime()) / 60000);
  const elapsed = formatElapsedMinutes(elapsedMin);

  if (last.type === "work") {
    return {
      activity: "work",
      headline: `On work · ${elapsed}`,
      detail: "Break due after 5 hours work — use the log bar when you stop.",
    };
  }

  if (last.type === "break") {
    return {
      activity: "break",
      headline: `On rest · ${elapsed}`,
      detail: "Tap Continue shift when you resume driving or End shift when finished.",
    };
  }

  if (last.type === "other_work") {
    return {
      activity: "other_work",
      headline: `On other work · ${elapsed}`,
      detail: "Tap Continue shift when you resume driving or End shift when finished.",
    };
  }

  return {
    activity: "idle",
    headline: "Ready to start shift",
    detail: undefined,
  };
}
