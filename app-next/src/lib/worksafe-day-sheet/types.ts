/**
 * WorkSafe WA day-sheet paint model (Phase B).
 *
 * Presentation only — uses existing EWD coverage derivation (no new fatigue rules).
 * Concept: docs/product/worksafe-wa-day-sheet-concept.md
 */

export type WorkSafeTrack = "work" | "break" | "non_work";

/** WorkSafe paper row labels (Element 2.2.4 wording). */
export const WORKSAFE_TRACK_LABELS: Record<WorkSafeTrack, string> = {
  work: "WORK TIME",
  break: "BREAKS FROM DRIVING",
  non_work: "NON WORK TIME",
};

export type WorkSafeDaySegment = {
  track: WorkSafeTrack;
  /** Inclusive start minute from local midnight [0, 1440). */
  startMin: number;
  /** Exclusive end minute (0–1440]. */
  endMin: number;
};

export type WorkSafeDayTotalsMinutes = {
  work: number;
  break: number;
  non_work: number;
};

/**
 * Exclusive WorkSafe track paint for one calendar day.
 * Ready for UI step-line (Phase C) and PDF (Phase D).
 */
export type WorkSafeDayPaint = {
  dateStr: string;
  /** Minutes from midnight that may be painted; later minutes are null (e.g. future today). */
  paintedUntilMinute: number;
  /** Length 1440; null = unpainted. */
  trackByMinute: Array<WorkSafeTrack | null>;
  /** Merged runs for step-line drawing (order chronological). */
  segments: WorkSafeDaySegment[];
  totalsMinutes: WorkSafeDayTotalsMinutes;
};
