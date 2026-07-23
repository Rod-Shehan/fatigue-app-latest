/**
 * Legacy flat-array metrics for dual-run (mirrors formulas in compliance.ts checkSoloRules).
 * Does not change live compliance behaviour.
 */

const MINUTES_7H = 7 * 60;
const MINUTES_24H = 24 * 60;
const MINUTES_72H = 72 * 60;
const MINUTES_14D = 14 * 24 * 60;

export function countContinuousBlocksOfAtLeastHours(
  slots: boolean[],
  minHours: number
): number {
  const need = minHours * 60;
  let count = 0;
  let run = 0;
  for (let i = 0; i <= slots.length; i++) {
    if (i < slots.length && slots[i]) {
      run += 1;
      continue;
    }
    if (run >= need) count += 1;
    run = 0;
  }
  return count;
}

/** Same window math as compliance solo 72h "ending now" slice. */
export function legacySolo72hWindowMetrics(
  nonWork: boolean[],
  effectiveEndMinute: number
): {
  totalNonWorkMinutes: number;
  sevenHourBlockCount: number;
  windowStart: number;
  windowEnd: number;
} | null {
  if (effectiveEndMinute < MINUTES_72H) return null;
  const start = effectiveEndMinute - MINUTES_72H;
  const window = nonWork.slice(start, effectiveEndMinute);
  return {
    totalNonWorkMinutes: window.filter(Boolean).length,
    sevenHourBlockCount: countContinuousBlocksOfAtLeastHours(window, 7),
    windowStart: start,
    windowEnd: effectiveEndMinute,
  };
}

/** Count ≥24h continuous non_work blocks in the last 14 days of a flat tape. */
export function legacySolo14dLongRestCount(nonWork: boolean[]): number {
  const from = Math.max(0, nonWork.length - MINUTES_14D);
  return countContinuousBlocksOfAtLeastHours(nonWork.slice(from), 24);
}

export { MINUTES_7H, MINUTES_24H, MINUTES_72H, MINUTES_14D };
