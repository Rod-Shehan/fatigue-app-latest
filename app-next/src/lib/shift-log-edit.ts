/**
 * Shift-log corrections: time and type on existing events while the week is unsigned.
 * Does not change rule thresholds — only how driver events are stored.
 */

import type { DayData } from "@/lib/api";
import {
  dayEventEditMessages,
  validateDayEventEdits,
  type PriorOpenActivity,
} from "@/lib/day-event-edit-rules";
import { getEffectiveOpenActivityAtDayEnd } from "@/lib/event-rollover";
import { sheetIsUnsignedForDriver } from "@/lib/sheet-record";
import { getSheetDayDateString, isPastRegulatoryWeek } from "@/lib/weeks";

export type ShiftLogEventPatch = {
  time?: string;
  type?: string;
};

export function canEditShiftLog(opts: {
  isManager: boolean;
  status: string;
  signature?: string | null;
  weekStarting: string;
}): boolean {
  if (!sheetIsUnsignedForDriver(opts.status, opts.signature)) return false;
  if (opts.isManager && isPastRegulatoryWeek(opts.weekStarting)) return false;
  return true;
}

export function applyShiftLogEventPatch(
  days: DayData[],
  dayIndex: number,
  eventIndex: number,
  patch: ShiftLogEventPatch
): DayData[] {
  if (dayIndex < 0 || dayIndex >= days.length) return days;
  const day = days[dayIndex];
  const events = [...(day?.events ?? [])];
  const current = events[eventIndex];
  if (!current) return days;
  const next = { ...current, ...patch };
  if (patch.type && patch.type !== "break") delete next.napFrom;
  if (patch.type && patch.type !== "work") delete next.driver;
  events[eventIndex] = next;
  const nextDays = [...days];
  nextDays[dayIndex] = { ...day, events };
  return nextDays;
}

export function sortShiftLogDayEvents(days: DayData[]): DayData[] {
  return days.map((day) => ({
    ...day,
    events: [...(day.events ?? [])].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    ),
  }));
}

export function shiftLogEditMessages(days: DayData[], weekStarting: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < days.length; i++) {
    const activityBeforeDay: PriorOpenActivity =
      i === 0
        ? null
        : getEffectiveOpenActivityAtDayEnd(
            days[i - 1]!,
            getSheetDayDateString(weekStarting, i - 1),
            ""
          );
    const messages = dayEventEditMessages(
      validateDayEventEdits(days[i]?.events ?? [], { activityBeforeDay })
    );
    for (const message of messages) {
      if (seen.has(message)) continue;
      seen.add(message);
      out.push(message);
    }
  }
  return out;
}
