/**
 * AMI coverage reclass — mandatory before compliance evaluation.
 * Does not mutate the raw event log (display stays raw).
 */

import {
  AMI_LONG_BREAK_AS_NON_WORK_MIN,
  AMI_MICRO_BREAK_AS_WORK_MAX,
  AMI_SHORT_GAP_AS_BREAK_MAX,
} from "./constants";
import type { AmiKind, AmiTape } from "./types";

function cloneTape(tape: AmiTape): AmiTape {
  return {
    originMs: tape.originMs,
    endMs: tape.endMs,
    kinds: tape.kinds.slice(),
  };
}

/** Short non_work gaps ≤30 adjacent to work → break. */
function reclassifyShortGapsAsBreak(kinds: AmiKind[]): void {
  const n = kinds.length;
  for (let s = 0; s < n; ) {
    if (kinds[s] !== "non_work") {
      s++;
      continue;
    }
    let runEnd = s;
    while (runEnd < n && kinds[runEnd] === "non_work") runEnd++;
    const runMinutes = runEnd - s;
    const hasWorkBefore = s > 0 && kinds[s - 1] === "work";
    const hasWorkAfter = runEnd < n && kinds[runEnd] === "work";
    if (runMinutes <= AMI_SHORT_GAP_AS_BREAK_MAX && (hasWorkBefore || hasWorkAfter)) {
      for (let k = s; k < runEnd; k++) kinds[k] = "break";
    }
    s = runEnd;
  }
}

/** Continuous break ≥31 → non_work. */
function reclassifyLongBreaksAsNonWork(kinds: AmiKind[]): void {
  const n = kinds.length;
  for (let s = 0; s < n; ) {
    if (kinds[s] !== "break") {
      s++;
      continue;
    }
    let runEnd = s;
    while (runEnd < n && kinds[runEnd] === "break") runEnd++;
    if (runEnd - s >= AMI_LONG_BREAK_AS_NON_WORK_MIN) {
      for (let k = s; k < runEnd; k++) kinds[k] = "non_work";
    }
    s = runEnd;
  }
}

/**
 * Completed break runs < 10 min → work.
 * A break run is "completed" when followed by a different kind (or end of tape with
 * a following kind that isn't break). Open trailing break at tape end is left as break
 * (still in progress) unless bounded by a later non-break on the tape.
 */
function reclassifyMicroBreaksAsWork(kinds: AmiKind[]): void {
  const n = kinds.length;
  for (let s = 0; s < n; ) {
    if (kinds[s] !== "break") {
      s++;
      continue;
    }
    let runEnd = s;
    while (runEnd < n && kinds[runEnd] === "break") runEnd++;
    const completed = runEnd < n; // followed by another kind
    const dur = runEnd - s;
    if (completed && dur <= AMI_MICRO_BREAK_AS_WORK_MAX) {
      for (let k = s; k < runEnd; k++) kinds[k] = "work";
    }
    s = runEnd;
  }
}

/**
 * Apply Section 1 reclass in a fixed order:
 * 1) short gap → break
 * 2) micro break → work
 * 3) long break → non_work
 *
 * Order: short gaps first (create breaks), then micro→work, then long→non_work
 * so a 35-min break becomes non_work and a 5-min completed break becomes work.
 */
export function reclassifyAmiTape(tape: AmiTape): AmiTape {
  const next = cloneTape(tape);
  reclassifyShortGapsAsBreak(next.kinds);
  reclassifyMicroBreaksAsWork(next.kinds);
  reclassifyLongBreaksAsNonWork(next.kinds);
  return next;
}

/** Paint + reclass convenience for rule evaluation. */
export function buildReclassifiedAmiTape(
  paint: (originMs: number, asOfMs: number) => AmiTape,
  originMs: number,
  asOfMs: number
): AmiTape {
  return reclassifyAmiTape(paint(originMs, asOfMs));
}
