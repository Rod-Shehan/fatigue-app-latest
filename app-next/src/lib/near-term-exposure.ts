/**
 * Live near-term exposure (break due, open shift, 7h recovery).
 * Detection only — does not change 5h / 7h / 17h rule engines.
 * Day cards are not used; callers pass a rolling event list.
 */

import { isOpenShiftEventType } from "@/lib/activity-kind";
import { getBreakDueByTime, type TimelineEvent } from "@/lib/five-hour-break-rule";
import {
  formatDriverRestDuePlanStop,
  formatDriverRestDueSoon,
  formatDriverRestOverdue,
  formatDriverRestRequiredBeforeWork,
  formatDriverShiftStillOpen,
} from "@/lib/product-copy";
import { getLastShiftEndTime, getNonWorkHoursSinceLastShiftEnd } from "@/lib/rolling-events";

const MS_MIN = 60 * 1000;
const MS_HOUR = 3600 * 1000;

export const NEAR_TERM_RECOVERY_HOURS = 7;
export const MANAGER_BREAK_HORIZON_MS = 24 * MS_HOUR;
export const MANAGER_OPEN_SHIFT_HOURS = 12;
export const DRIVER_BREAK_HORIZON_MS = 2 * MS_HOUR;
export const DRIVER_BREAK_ATTENTION_MS = 45 * MS_MIN;
export const DRIVER_OPEN_SHIFT_HOURS = 7;

export type NearTermKind =
  | "break_due"
  | "break_overdue"
  | "no_stop_long"
  | "insufficient_nonwork";

export type NearTermSignal = {
  kind: NearTermKind;
  dueByMs?: number;
  lastType?: string;
  elapsedHours?: number;
  nonWorkHours?: number;
  remainingRestMinutes?: number;
  safeAtMs?: number;
};

export type NearTermDetectOpts = {
  breakHorizonMs: number;
  openShiftHours: number;
};

export const MANAGER_NEAR_TERM_OPTS: NearTermDetectOpts = {
  breakHorizonMs: MANAGER_BREAK_HORIZON_MS,
  openShiftHours: MANAGER_OPEN_SHIFT_HOURS,
};

export const DRIVER_NEAR_TERM_OPTS: NearTermDetectOpts = {
  breakHorizonMs: DRIVER_BREAK_HORIZON_MS,
  openShiftHours: DRIVER_OPEN_SHIFT_HOURS,
};

export function formatClockHm(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatHoursMinutes(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}

export function detectNearTermSignals(
  events: TimelineEvent[],
  nowMs: number,
  opts: NearTermDetectOpts
): NearTermSignal[] {
  const out: NearTermSignal[] = [];
  if (!events.length) return out;

  const last = events[events.length - 1]!;
  const lastMs = new Date(last.time).getTime();
  const elapsedHours = (nowMs - lastMs) / MS_HOUR;

  const dueBy = getBreakDueByTime(events, nowMs);
  if (dueBy != null && dueBy <= nowMs + opts.breakHorizonMs) {
    out.push({
      kind: dueBy <= nowMs ? "break_overdue" : "break_due",
      dueByMs: dueBy,
    });
  }

  if (isOpenShiftEventType(last.type) && elapsedHours >= opts.openShiftHours) {
    out.push({
      kind: "no_stop_long",
      lastType: last.type,
      elapsedHours,
    });
  }

  if (last.type === "stop" || last.type === "non_work") {
    const lastStopMs = getLastShiftEndTime(events, nowMs + 1);
    const nonWorkHours = getNonWorkHoursSinceLastShiftEnd(events, nowMs);
    if (lastStopMs != null && nonWorkHours != null && nonWorkHours < NEAR_TERM_RECOVERY_HOURS) {
      const remainingRestMinutes = Math.max(
        0,
        Math.ceil(NEAR_TERM_RECOVERY_HOURS * 60 - nonWorkHours * 60)
      );
      out.push({
        kind: "insufficient_nonwork",
        nonWorkHours,
        remainingRestMinutes,
        safeAtMs: lastStopMs + NEAR_TERM_RECOVERY_HOURS * MS_HOUR,
      });
    }
  }

  return out;
}

export function managerDetailForSignal(signal: NearTermSignal): string {
  switch (signal.kind) {
    case "break_overdue":
      return `Break overdue (was due by ${formatClockHm(signal.dueByMs ?? 0)})`;
    case "break_due":
      return `Break due by ${formatClockHm(signal.dueByMs ?? 0)}`;
    case "no_stop_long": {
      const hours = Math.floor(signal.elapsedHours ?? 0);
      return `No End shift logged for ${hours}h+ (last: ${signal.lastType ?? "work"})`;
    }
    case "insufficient_nonwork": {
      const hours = (signal.nonWorkHours ?? 0).toFixed(1);
      const by = formatClockHm(signal.safeAtMs ?? 0);
      return `Recovery in progress: ${hours}h since End shift (7h target by ${by})`;
    }
  }
}

export type DriverNearTermChipLine = {
  line: string;
  tone: "caution" | "attention";
};

export function driverChipLinesFromSignals(
  signals: NearTermSignal[],
  nowMs: number,
  opts?: { omitRestWindow?: boolean; omitBreakReminder?: boolean }
): DriverNearTermChipLine[] {
  const lines: DriverNearTermChipLine[] = [];
  for (const signal of signals) {
    if (signal.kind === "insufficient_nonwork" && opts?.omitRestWindow) continue;
    if (
      opts?.omitBreakReminder &&
      (signal.kind === "break_due" || signal.kind === "break_overdue")
    ) {
      continue;
    }
    const mapped = driverLineForSignal(signal, nowMs);
    if (mapped) lines.push(mapped);
  }
  return lines;
}

function driverLineForSignal(signal: NearTermSignal, nowMs: number): DriverNearTermChipLine | null {
  switch (signal.kind) {
    case "break_overdue":
      return {
        line: formatDriverRestOverdue(formatClockHm(signal.dueByMs ?? 0)),
        tone: "attention",
      };
    case "break_due": {
      const dueBy = signal.dueByMs ?? nowMs;
      const remainingMs = dueBy - nowMs;
      const timeHm = formatClockHm(dueBy);
      if (remainingMs <= DRIVER_BREAK_ATTENTION_MS) {
        return { line: formatDriverRestDueSoon(timeHm), tone: "attention" };
      }
      return { line: formatDriverRestDuePlanStop(timeHm), tone: "caution" };
    }
    case "no_stop_long":
      return { line: formatDriverShiftStillOpen(), tone: "attention" };
    case "insufficient_nonwork": {
      const remaining = formatHoursMinutes(signal.remainingRestMinutes ?? 0);
      return {
        line: formatDriverRestRequiredBeforeWork(remaining),
        tone: "attention",
      };
    }
  }
}
