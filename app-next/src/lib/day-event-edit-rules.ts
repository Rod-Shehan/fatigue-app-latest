/**
 * Edit-day event sequence rules — block illogical diary corrections.
 *
 * Rolling timeline still applies: open work may continue overnight without a
 * same-day closer. Breaks must sit inside a work bout (not inside non-work).
 * End shift must close work/break. These are entry-shape rules, not Reg 184E
 * threshold changes.
 */

import type { ActivityKey } from "@/lib/theme";

export type DayEventLike = {
  time: string;
  type: string;
};

/** Activity still open when this calendar day starts (prior day last event). */
export type PriorOpenActivity = "work" | "break" | "non_work" | null;

export type DayEventEditIssue = {
  /** Index in the sorted event list, or -1 for whole-list issues. */
  eventIndex: number;
  code:
    | "break_without_work"
    | "end_shift_without_work"
    | "duplicate_consecutive"
    | "open_break_at_end"
    | "invalid_time"
    | "out_of_order";
  message: string;
};

const LABELS: Record<string, string> = {
  work: "Work",
  break: "Rest",
  other_work: "Other work",
  non_work: "Non-work",
  stop: "End shift",
};

function isEditableType(type: string): type is ActivityKey {
  return type === "work" || type === "break" || type === "other_work" || type === "non_work" || type === "stop";
}

function sortEvents(events: DayEventLike[]): DayEventLike[] {
  return [...events].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

/**
 * Activity in force just before `sorted[index]` on this day.
 * Uses the previous event on the day, or prior-day open activity for the first event.
 */
export function activityBeforeEvent(
  sorted: DayEventLike[],
  index: number,
  activityBeforeDay: PriorOpenActivity
): PriorOpenActivity | "stop" {
  if (index <= 0) {
    return activityBeforeDay;
  }
  const prev = sorted[index - 1]!;
  if (prev.type === "stop") return "stop";
  if (prev.type === "other_work") return "work";
  if (prev.type === "work" || prev.type === "break" || prev.type === "non_work") {
    return prev.type;
  }
  return activityBeforeDay;
}

function inWorkBout(prior: PriorOpenActivity | "stop"): boolean {
  return prior === "work" || prior === "break";
}

/**
 * Validate a day's edited events for illogical sequences.
 * Does not invent midnight resets — prior-day open activity must be passed in.
 */
export function validateDayEventEdits(
  events: DayEventLike[],
  options?: { activityBeforeDay?: PriorOpenActivity }
): DayEventEditIssue[] {
  const activityBeforeDay = options?.activityBeforeDay ?? null;
  const issues: DayEventEditIssue[] = [];
  if (!events.length) return issues;

  for (let i = 0; i < events.length; i++) {
    const t = new Date(events[i]!.time).getTime();
    if (!Number.isFinite(t)) {
      issues.push({
        eventIndex: i,
        code: "invalid_time",
        message: "Each event needs a valid time.",
      });
    }
  }

  const sorted = sortEvents(events);
  // Map sorted index → original index for UI highlighting when possible
  const originalIndex = (ev: DayEventLike): number =>
    events.findIndex((e) => e.time === ev.time && e.type === ev.type);

  for (let i = 1; i < sorted.length; i++) {
    const prevMs = new Date(sorted[i - 1]!.time).getTime();
    const curMs = new Date(sorted[i]!.time).getTime();
    if (Number.isFinite(prevMs) && Number.isFinite(curMs) && curMs < prevMs) {
      issues.push({
        eventIndex: originalIndex(sorted[i]!),
        code: "out_of_order",
        message: "Event times must be in order.",
      });
    }
  }

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i]!;
    if (!isEditableType(ev.type)) continue;
    const prior = activityBeforeEvent(sorted, i, activityBeforeDay);
    const oi = originalIndex(ev);

    if (i > 0 && sorted[i - 1]!.type === ev.type) {
      issues.push({
        eventIndex: oi,
        code: "duplicate_consecutive",
        message: `Already ${LABELS[ev.type] ?? ev.type} — change the existing event’s time, or pick a different type.`,
      });
      continue;
    }

    if (ev.type === "break" || ev.type === "other_work") {
      if (!inWorkBout(prior)) {
        const from =
          prior === "non_work"
            ? "non-work"
            : prior === "stop"
              ? "End shift"
              : "the start of the day (no open work)";
        const kind = ev.type === "other_work" ? "Other work" : "Rest";
        issues.push({
          eventIndex: oi,
          code: "break_without_work",
          message: `${kind} needs work before it — you can’t start ${kind.toLowerCase()} from ${from}. Add or keep Work first.`,
        });
      }
    }

    if (ev.type === "stop") {
      if (!inWorkBout(prior)) {
        issues.push({
          eventIndex: oi,
          code: "end_shift_without_work",
          message:
            "End shift needs open Work, Rest, or Other work first — it can’t follow non-work or sit alone with no shift.",
        });
      }
    }
  }

  const last = sorted[sorted.length - 1];
  if (last?.type === "break") {
    issues.push({
      eventIndex: originalIndex(last),
      code: "open_break_at_end",
      message:
        "Rest is still open — add Work (continue), Other work, Non-work, or End shift after Rest. Rest can’t be the last event.",
    });
  }

  return issues;
}

export function dayEventEditsBlocked(issues: DayEventEditIssue[]): boolean {
  return issues.length > 0;
}

/** Unique messages for dialog banners (order preserved). */
export function dayEventEditMessages(issues: DayEventEditIssue[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const issue of issues) {
    if (seen.has(issue.message)) continue;
    seen.add(issue.message);
    out.push(issue.message);
  }
  return out;
}
