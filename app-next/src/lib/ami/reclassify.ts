/**
 * AMI coverage reclass — mandatory before compliance evaluation.
 * Does not mutate the raw event log (display stays raw).
 *
 * Driver-logged events remain the source of truth for break vs non-work:
 * - Do not invent break from short non_work gaps (End shift / idle stay non_work).
 * - Completed actioned break < 10 min → work.
 * - Continuous actioned break ≥ 31 min → non_work.
 */

import {
  AMI_LONG_BREAK_AS_NON_WORK_MIN,
  AMI_MICRO_BREAK_AS_WORK_MAX,
} from "./constants";
import type { AmiKind, AmiTape } from "./types";

function cloneTape(tape: AmiTape): AmiTape {
  return {
    originMs: tape.originMs,
    endMs: tape.endMs,
    kinds: tape.kinds.slice(),
  };
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
 * 1) micro break → work
 * 2) long break → non_work
 *
 * Order: micro→work first, then long→non_work so a 35-min break becomes non_work
 * and a 5-min completed break becomes work. Short non_work gaps are never promoted to break.
 */
export function reclassifyAmiTape(tape: AmiTape): AmiTape {
  const next = cloneTape(tape);
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
