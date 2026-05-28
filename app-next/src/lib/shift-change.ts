/**
 * WA Reg 184E(4) shift-change education and helpers.
 * Drivers are not assumed to know the rule — copy is written for prevention first.
 */

import type { ComplianceDayData } from "@/lib/compliance";

export const SHIFT_CHANGE_MIN_CONSECUTIVE_WORK_DAYS = 5;
export const SHIFT_CHANGE_MIN_GAP_HOURS = 24;

export type ShiftLabel = "A" | "B";

export function shiftLabelDisplay(label: ShiftLabel | "" | null | undefined): string {
  if (label === "A") return "Day (A)";
  if (label === "B") return "Night (B)";
  return "(not set)";
}

export function oppositeShiftLabel(label: ShiftLabel): ShiftLabel {
  return label === "A" ? "B" : "A";
}

function dayHasWork(day: ComplianceDayData | undefined): boolean {
  if (!day) return false;
  if ((day.work_time ?? []).some(Boolean)) return true;
  return day.events?.some((e) => e.type === "work") ?? false;
}

/** Consecutive worked-day run that includes `dayIndex` (inclusive). */
export function getConsecutiveWorkRun(
  days: ComplianceDayData[],
  dayIndex: number
): { start: number; end: number; length: number } | null {
  if (dayIndex < 0 || dayIndex >= days.length || !dayHasWork(days[dayIndex])) return null;
  let start = dayIndex;
  while (start > 0 && dayHasWork(days[start - 1])) start--;
  let end = dayIndex;
  while (end < days.length - 1 && dayHasWork(days[end + 1])) end++;
  return { start, end, length: end - start + 1 };
}

export function consecutiveWorkDaysEndingAt(days: ComplianceDayData[], dayIndex: number): number {
  const run = getConsecutiveWorkRun(days, dayIndex);
  if (!run) return 0;
  return dayIndex - run.start + 1;
}

/** True when ending shift today sits in a 5+ day work streak (shift-change rule may apply). */
export function shouldEducateAfterEndShift(days: ComplianceDayData[], dayIndex: number): boolean {
  return consecutiveWorkDaysEndingAt(days, dayIndex) >= SHIFT_CHANGE_MIN_CONSECUTIVE_WORK_DAYS;
}

export type ShiftChangeGapDetail = {
  fromDayIndex: number;
  toDayIndex: number;
  fromLabel: ShiftLabel;
  toLabel: ShiftLabel;
  gapHours: number;
  stopTimeIso?: string;
  workTimeIso?: string;
};

export function formatShiftChangeGapHours(gapHours: number): string {
  const h = Math.floor(gapHours);
  const m = Math.round((gapHours % 1) * 60);
  return `${h}h ${m}m`;
}

export function formatShiftChangeViolationMessage(d: ShiftChangeGapDetail): string {
  const gap = formatShiftChangeGapHours(d.gapHours);
  const need = `${SHIFT_CHANGE_MIN_GAP_HOURS}h`;
  return (
    `After 5+ days of work, changing shift pattern (${shiftLabelDisplay(d.fromLabel)} → ${shiftLabelDisplay(d.toLabel)}) ` +
    `needs at least ${need} off between End shift and your next Work. Your gap was ${gap} — take more non-work time before starting again.`
  );
}

export function formatShiftChangeMissingTimesMessage(
  fromLabel: ShiftLabel,
  toLabel: ShiftLabel
): string {
  return (
    `Shift pattern change marked (${shiftLabelDisplay(fromLabel)} → ${shiftLabelDisplay(toLabel)}), ` +
    `but we need End shift time on the earlier day and Work time on the next day to check the ${SHIFT_CHANGE_MIN_GAP_HOURS}h break. Log those times on the day cards.`
  );
}

export const SHIFT_CHANGE_EDUCATION_MESSAGE =
  "You've worked 5+ days in a row. If you swap between day and night shifts, set Shift pattern (A/B) on each work day and take at least 24 hours off when the pattern changes (A↔B).";

export const SHIFT_PATTERN_FIELD_HELP =
  "Not the same as Start/End shift. Use Day (A) or Night (B) so we can check the 24h off rule when you change patterns after 5+ work days in a row.";

export const SHIFT_PATTERN_END_SHIFT_PROMPT =
  "You've worked 5+ days in a row. If your next shift is a different pattern (e.g. day → night), WA rules require at least 24 hours off between End shift and your next Work. Set Shift pattern (A/B) on today and the next work day.";
