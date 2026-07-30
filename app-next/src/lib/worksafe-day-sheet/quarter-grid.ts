/**
 * 15-minute paper grid helpers for WorkSafe day sheet (UI + PDF).
 */

import type { WorkSafeDayPaint, WorkSafeTrack } from "./types";

export const WORKSAFE_QUARTERS_PER_DAY = 96;
export const WORKSAFE_TRACKS: WorkSafeTrack[] = ["work", "break", "non_work"];

/** Paper hour headers: 24.00 (midnight hour), then 1.00 … 23.00 */
export const WORKSAFE_HOUR_LABELS = [
  "24.00",
  ...Array.from({ length: 23 }, (_, i) => `${i + 1}.00`),
] as const;

/** Dominant exclusive track in a 15-minute quarter, or null if unpainted. */
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
