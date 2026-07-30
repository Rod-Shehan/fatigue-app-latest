/**
 * 15-minute paper grid helpers for WorkSafe day sheet (UI + PDF).
 *
 * Visual grid is padded by one quarter: empty 15m at the start, extra 15m at the end,
 * so day minutes 0–1440 sit in columns 1–96. First hour header is blank (no 24.00).
 */

import type { WorkSafeDayPaint, WorkSafeTrack } from "./types";

/** Real day quarters (00:00–24:00). */
export const WORKSAFE_QUARTERS_PER_DAY = 96;
/** Leading empty 15m column (shifts hour ticks / line one quarter right). */
export const WORKSAFE_GRID_PAD_QUARTERS = 1;
/** Columns drawn in the chart (pad + day). */
export const WORKSAFE_QUARTER_COLS = WORKSAFE_QUARTERS_PER_DAY + WORKSAFE_GRID_PAD_QUARTERS;
/** Chart x units: pad minutes + day minutes. */
export const WORKSAFE_CHART_MINUTE_WIDTH =
  WORKSAFE_QUARTER_COLS * 15; /* 1455 */

export const WORKSAFE_TRACKS: WorkSafeTrack[] = ["work", "break", "non_work"];

/**
 * Paper hour headers over the 96 day quarters (after the pad column):
 * first hour block blank (was 24.00), then 1.00 … 23.00.
 */
export const WORKSAFE_HOUR_LABELS = [
  "",
  ...Array.from({ length: 23 }, (_, i) => `${i + 1}.00`),
] as const;

/** Map day minute [0,1440] → chart x (after leading 15m pad). */
export function dayMinuteToChartX(minute: number): number {
  return WORKSAFE_GRID_PAD_QUARTERS * 15 + minute;
}

/** Dominant exclusive track in a 15-minute day quarter, or null if unpainted. */
export function dominantTrackInQuarter(
  trackByMinute: WorkSafeDayPaint["trackByMinute"],
  quarterIndex: number
): WorkSafeTrack | null {
  const start = quarterIndex * 15;
  const end = Math.min(1440, start + 15);
  const counts: Record<WorkSafeTrack, number> = { work: 0, break: 0, non_work: 0 };
  let painted = 0;
  for (let m = start; m < end; m++) {
    const t = trackByMinute[m];
    if (t == null) continue;
    counts[t] += 1;
    painted += 1;
  }
  if (painted === 0) return null;
  let best: WorkSafeTrack = "work";
  let bestN = -1;
  for (const t of WORKSAFE_TRACKS) {
    if (counts[t] > bestN) {
      bestN = counts[t];
      best = t;
    }
  }
  return best;
}

export function quarterTracksFromPaint(paint: WorkSafeDayPaint): Array<WorkSafeTrack | null> {
  const out: Array<WorkSafeTrack | null> = Array(WORKSAFE_QUARTERS_PER_DAY).fill(null);
  for (let q = 0; q < WORKSAFE_QUARTERS_PER_DAY; q++) {
    out[q] = dominantTrackInQuarter(paint.trackByMinute, q);
  }
  return out;
}
