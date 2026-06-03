/**
 * WA Reg 184E(4) shift-change education and helpers.
 *
 * Rolling timeline model:
 * - "5+ consecutive work days" in the Act → 5×24h = 7200 minutes on the same shift pattern (A/B).
 * - Calendar days are for display and where pattern labels are recorded — not rule boundaries.
 * - 24h between shift changes = End shift → next Work on the event timeline (not midnight).
 */

import type { ComplianceDayData } from "@/lib/compliance";
import { getEventsInTimeOrder } from "@/lib/rolling-events";

/** Reg 184E(4) "5+ consecutive work days" as minutes on the rolling timeline (5 × 24h). */
export const SHIFT_PATTERN_STREAK_MINUTES = 5 * 24 * 60;
export const SHIFT_PATTERN_STREAK_HOURS = 120;

/** Display-only equivalent for legally familiar copy (do not use for rule logic). */
export const SHIFT_PATTERN_STREAK_DISPLAY_DAYS = 5;

/** @deprecated Use SHIFT_PATTERN_STREAK_MINUTES for logic; kept for import compatibility. */
export const SHIFT_CHANGE_MIN_CONSECUTIVE_WORK_DAYS = SHIFT_PATTERN_STREAK_DISPLAY_DAYS;

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

function segmentDurationMinutes(seg: { startMs: number; endMs: number }): number {
  return Math.max(0, (seg.endMs - seg.startMs) / 60000);
}

/** Human-readable streak for UI (legally familiar "days" from minute total). */
export function formatPatternStreakForDisplay(workMinutes: number): string {
  if (workMinutes >= SHIFT_PATTERN_STREAK_MINUTES) {
    return `${SHIFT_PATTERN_STREAK_DISPLAY_DAYS}+ days (${SHIFT_PATTERN_STREAK_HOURS}h+ on this pattern)`;
  }
  const h = Math.round(workMinutes / 60);
  return `${h}h on this pattern`;
}

export function patternStreakThresholdMet(workMinutes: number): boolean {
  return workMinutes >= SHIFT_PATTERN_STREAK_MINUTES;
}

/**
 * Work minutes on the timeline for one shift pattern, walking backward from `beforeMs`
 * through consecutive ended shifts with that label (most recent streak only).
 */
export function samePatternWorkMinutesBefore(
  days: ComplianceDayData[],
  pattern: ShiftLabel,
  beforeMs: number
): number {
  const segments = buildEndedWorkSegments(days);
  let totalMin = 0;
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]!;
    if (seg.endMs > beforeMs) continue;
    if (seg.shiftLabel !== pattern) break;
    totalMin += segmentDurationMinutes(seg);
  }
  return totalMin;
}

/** Minutes of the current pattern ending at the last stop on or before this day card (or now). */
export function samePatternWorkMinutesEndingAt(
  days: ComplianceDayData[],
  dayIndex: number,
  asOfMs: number = Date.now()
): number {
  const label = shiftLabelOnDay(days, dayIndex);
  if (!label) return 0;

  const ordered = getEventsInTimeOrder(days);
  let beforeMs = asOfMs;
  for (let i = ordered.length - 1; i >= 0; i--) {
    const ev = ordered[i]!;
    const t = new Date(ev.time).getTime();
    if (!Number.isFinite(t) || ev.dayIndex > dayIndex) continue;
    if (ev.dayIndex === dayIndex && ev.type === "stop") {
      beforeMs = t;
      break;
    }
  }
  return samePatternWorkMinutesBefore(days, label, beforeMs);
}

/**
 * @deprecated Logic uses minutes; returns display-day equivalent only.
 */
export function getConsecutiveWorkRun(
  days: ComplianceDayData[],
  dayIndex: number
): { start: number; end: number; length: number } | null {
  const mins = samePatternWorkMinutesEndingAt(days, dayIndex);
  if (mins <= 0) return null;
  const equivDays = Math.max(1, Math.floor(mins / (24 * 60)));
  return { start: dayIndex, end: dayIndex, length: equivDays };
}

/** @deprecated Display-day equivalent; use samePatternWorkMinutesEndingAt for logic. */
export function consecutiveWorkDaysEndingAt(days: ComplianceDayData[], dayIndex: number): number {
  const mins = samePatternWorkMinutesEndingAt(days, dayIndex);
  return Math.floor(mins / (24 * 60));
}

export function shouldEducateAfterEndShift(days: ComplianceDayData[], dayIndex: number): boolean {
  return patternStreakThresholdMet(samePatternWorkMinutesEndingAt(days, dayIndex));
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

export type EndedWorkSegment = {
  startMs: number;
  endMs: number;
  startDayIndex: number;
  shiftLabel: ShiftLabel | "";
};

export function buildEndedWorkSegments(days: ComplianceDayData[]): EndedWorkSegment[] {
  const ordered = getEventsInTimeOrder(days);
  const segments: EndedWorkSegment[] = [];
  let open: { startMs: number; startDayIndex: number; label: ShiftLabel | "" } | null = null;

  for (const ev of ordered) {
    const t = new Date(ev.time).getTime();
    if (!Number.isFinite(t)) continue;

    if (ev.type === "work") {
      if (!open) {
        open = {
          startMs: t,
          startDayIndex: ev.dayIndex,
          label: shiftLabelOnDay(days, ev.dayIndex),
        };
      }
      continue;
    }

    if (ev.type === "stop" && open) {
      segments.push({
        startMs: open.startMs,
        endMs: t,
        startDayIndex: open.startDayIndex,
        shiftLabel: open.label,
      });
      open = null;
    }
  }

  return segments;
}

export type ShiftPatternTransition = {
  fromSegment: EndedWorkSegment;
  toSegment: EndedWorkSegment;
  fromLabel: ShiftLabel;
  toLabel: ShiftLabel;
  gapHours: number;
  stopTimeMs: number;
  workTimeMs: number;
};

function shiftLabelOnDay(days: ComplianceDayData[], dayIndex: number): ShiftLabel | "" {
  const l = days[dayIndex]?.shift_label;
  return l === "A" || l === "B" ? l : "";
}

export function findShiftPatternTransitionsOnTimeline(
  days: ComplianceDayData[]
): ShiftPatternTransition[] {
  const ordered = getEventsInTimeOrder(days);
  const out: ShiftPatternTransition[] = [];

  let open: { startMs: number; startDayIndex: number; label: ShiftLabel | "" } | null = null;
  let lastEnded: EndedWorkSegment | null = null;

  for (const ev of ordered) {
    const t = new Date(ev.time).getTime();
    if (!Number.isFinite(t)) continue;

    if (ev.type === "work") {
      if (!open) {
        const label = shiftLabelOnDay(days, ev.dayIndex);
        open = { startMs: t, startDayIndex: ev.dayIndex, label };
        if (
          lastEnded &&
          lastEnded.shiftLabel &&
          label &&
          lastEnded.shiftLabel !== label
        ) {
          const toSeg: EndedWorkSegment = {
            startMs: t,
            endMs: t,
            startDayIndex: ev.dayIndex,
            shiftLabel: label,
          };
          out.push({
            fromSegment: lastEnded,
            toSegment: toSeg,
            fromLabel: lastEnded.shiftLabel,
            toLabel: label,
            gapHours: (t - lastEnded.endMs) / (3600 * 1000),
            stopTimeMs: lastEnded.endMs,
            workTimeMs: t,
          });
        }
      }
      continue;
    }

    if (ev.type === "stop" && open) {
      lastEnded = {
        startMs: open.startMs,
        endMs: t,
        startDayIndex: open.startDayIndex,
        shiftLabel: open.label,
      };
      open = null;
    }
  }

  return out;
}

/** True when this A↔B change follows ≥7200 minutes on the prior pattern (rolling timeline). */
export function shiftPatternChangeRequires24hBreak(
  days: ComplianceDayData[],
  transition: ShiftPatternTransition
): boolean {
  const priorMinutes = samePatternWorkMinutesBefore(
    days,
    transition.fromLabel,
    transition.workTimeMs
  );
  return patternStreakThresholdMet(priorMinutes);
}

/** Longest contiguous unlabeled shift periods on the timeline (no A/B on segment). */
export function maxUnlabeledShiftMinutesOnTimeline(days: ComplianceDayData[]): number {
  const segments = buildEndedWorkSegments(days);
  let runMin = 0;
  let maxMin = 0;
  for (const seg of segments) {
    if (seg.shiftLabel) {
      maxMin = Math.max(maxMin, runMin);
      runMin = 0;
      continue;
    }
    runMin += segmentDurationMinutes(seg);
  }
  return Math.max(maxMin, runMin);
}

export function shouldShowShiftPatternEducation(days: ComplianceDayData[]): boolean {
  return patternStreakThresholdMet(maxUnlabeledShiftMinutesOnTimeline(days));
}

export function formatShiftChangeGapHours(gapHours: number): string {
  const h = Math.floor(gapHours);
  const m = Math.round((gapHours % 1) * 60);
  return `${h}h ${m}m`;
}

export function formatShiftChangeViolationMessage(d: ShiftChangeGapDetail): string {
  const gap = formatShiftChangeGapHours(d.gapHours);
  const need = `${SHIFT_CHANGE_MIN_GAP_HOURS}h`;
  return (
    `After ${SHIFT_PATTERN_STREAK_HOURS}h+ on ${shiftLabelDisplay(d.fromLabel)}, changing shift pattern ` +
    `(${shiftLabelDisplay(d.fromLabel)} → ${shiftLabelDisplay(d.toLabel)}) needs at least ${need} off ` +
    `between End shift and your next Work on the timeline. Your gap was ${gap} — take more non-work time before starting again.`
  );
}

export function formatShiftChangeMissingTimesMessage(
  fromLabel: ShiftLabel,
  toLabel: ShiftLabel
): string {
  return (
    `Shift pattern change marked (${shiftLabelDisplay(fromLabel)} → ${shiftLabelDisplay(toLabel)}), ` +
    `but we need End shift before the change and Work after it on the timeline to check the ${SHIFT_CHANGE_MIN_GAP_HOURS}h break.`
  );
}

export const SHIFT_CHANGE_EDUCATION_MESSAGE =
  `You've reached ${SHIFT_PATTERN_STREAK_HOURS}h+ on the same shift stretch without setting Day/Night pattern (A/B). ` +
  `If you swap patterns, set A/B on your work days and take at least 24 hours off between End shift and your next Work when the pattern changes.`;

export const SHIFT_PATTERN_FIELD_HELP =
  `Day (A) or Night (B) is for WA rules when you swap patterns after ${SHIFT_PATTERN_STREAK_HOURS}h+ on one pattern — ` +
  `then you need 24 hours off between End shift and your next Work on the timeline.`;

export const SHIFT_PATTERN_END_SHIFT_PROMPT =
  `You've been on the same shift pattern for ${SHIFT_PATTERN_STREAK_HOURS}h+ (rolling). ` +
  `If your next shift uses a different pattern (day ↔ night), take at least 24 hours off between End shift and your next Work.`;
