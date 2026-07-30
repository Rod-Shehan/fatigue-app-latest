/**
 * 15-minute paper grid helpers for WorkSafe day sheet (UI + PDF).
 *
 * Hour header cells use border-right at the end of each hour (after 4 quarters).
 * Body ticks must put the heavy vertical on the same boundary: the right edge of
 * quarter index 3, 7, 11, … — not on q % 4 === 0 (that sat 15m early).
 */

import type { WorkSafeDayPaint, WorkSafeTrack } from "./types";

export const WORKSAFE_QUARTERS_PER_DAY = 96;
export const WORKSAFE_MINUTES_PER_DAY = 1440;

export const WORKSAFE_TRACKS: WorkSafeTrack[] = ["work", "break", "non_work"];

/**
 * Paper hour headers: first block blank (no 24.00), then 1.00 … 23.00.
 * Each label spans 4 quarter columns.
 */
export const WORKSAFE_HOUR_LABELS = [
  "",
  ...Array.from({ length: 23 }, (_, i) => `${i + 1}.00`),
] as const;

/** True when this quarter's right edge is an hour boundary (matches header cell borders). */
export function isWorkSafeHourBoundaryQuarter(quarterIndex: number): boolean {
  return quarterIndex % 4 === 3;
}

/** Dominant exclusive track in a 15-minute day quarter, or null if unpainted. */
export function dominantTrackInQuarter(
  trackByMinute: WorkSafeDayPaint["trackByMinute"],
  quarterIndex: number
): WorkSafeTrack | null {
  const start = quarterIndex * 15;
  const end = Math.min(WORKSAFE_MINUTES_PER_DAY, start + 15);
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
