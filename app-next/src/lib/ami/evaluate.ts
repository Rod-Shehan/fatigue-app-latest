/**
 * AMI Phase 1 rule evaluators — pure functions on reclassified tapes / events.
 * Not wired into live compliance.
 */

import {
  AMI_14D_LONG_REST_BLOCK,
  AMI_14D_LONG_REST_COUNT,
  AMI_14D_WINDOW,
  AMI_168H_MAX_WORK,
  AMI_168H_RESET_NON_WORK,
  AMI_168H_WARN_WORK,
  AMI_17H_LOOKBACK,
  AMI_17H_WORK_BREAK_CEILING,
  AMI_48H_MIN_CONTINUOUS_NON_WORK,
  AMI_48H_WINDOW,
  AMI_72H_MAX_GAP_BETWEEN_QUAL_BLOCKS,
  AMI_72H_MIN_TOTAL_NON_WORK,
  AMI_72H_QUAL_BLOCK,
  AMI_72H_QUAL_BLOCK_COUNT,
  AMI_72H_WINDOW,
  AMI_7D_MIN_CONTINUOUS_BLOCK,
  AMI_7D_MIN_NON_WORK_PIECE,
  AMI_7D_MIN_TOTAL_NON_WORK,
  AMI_7D_WINDOW,
  AMI_NON_WORK_ANCHOR,
  AMI_PATTERN_CHANGE_REST,
  AMI_QUAL_BREAK_FRAGMENT,
  AMI_SOLO_BETWEEN_SHIFT_REST,
  AMI_TWO_UP_24H_MIN_NON_WORK,
  AMI_TWO_UP_24H_WINDOW,
  AMI_WORK_WINDOW,
} from "./constants";
import { eventTimeMs, lastAmiEventAt, paintAmiTape, segmentsFromTape, sortAmiEvents } from "./paint";
import { reclassifyAmiTape } from "./reclassify";
import type { AmiEvent, AmiKind, AmiTape } from "./types";

function countKind(kinds: AmiKind[], kind: AmiKind, from = 0, toExclusive?: number): number {
  const end = toExclusive ?? kinds.length;
  let n = 0;
  for (let i = from; i < end; i++) if (kinds[i] === kind) n++;
  return n;
}

function continuousRuns(
  kinds: AmiKind[],
  kind: AmiKind,
  from = 0,
  toExclusive?: number
): Array<{ start: number; end: number; length: number }> {
  const end = toExclusive ?? kinds.length;
  const runs: Array<{ start: number; end: number; length: number }> = [];
  for (let s = from; s < end; ) {
    if (kinds[s] !== kind) {
      s++;
      continue;
    }
    let e = s;
    while (e < end && kinds[e] === kind) e++;
    runs.push({ start: s, end: e, length: e - s });
    s = e;
  }
  return runs;
}

export function buildEvalTape(
  events: AmiEvent[],
  asOfMs: number,
  lookbackMin: number,
  options?: { clipToFirstEvent?: boolean }
): AmiTape {
  let originMs = asOfMs - lookbackMin * 60_000;
  if (options?.clipToFirstEvent) {
    const sorted = sortAmiEvents(events);
    const first = sorted.find((e) => {
      const t = eventTimeMs(e);
      return Number.isFinite(t) && t <= asOfMs;
    });
    if (first) {
      // Do not invent non_work before the record starts (avoids fake 24h rests / 168h padding).
      originMs = Math.max(originMs, eventTimeMs(first));
    }
  }
  return reclassifyAmiTape(paintAmiTape(events, originMs, asOfMs));
}

// —— 5h work / qualifying break (on reclassified tape) ——

export type AmiRestSlots = { slot1: boolean; slot2: boolean };

export function applyQualifyingBreakToSlots(durationMin: number, slots: AmiRestSlots): void {
  if (durationMin < AMI_QUAL_BREAK_FRAGMENT) return;
  if (durationMin >= 20) {
    slots.slot1 = true;
    slots.slot2 = true;
    return;
  }
  if (!slots.slot1) slots.slot1 = true;
  else if (!slots.slot2) slots.slot2 = true;
}

export function qualifyingRestComplete(slots: AmiRestSlots): boolean {
  return slots.slot1 && slots.slot2;
}

/**
 * Rolling last 300 work minutes ending at the last work on the tape (not at trailing
 * non_work after End shift). Matches event-window scoring used by five-hour-break-rule.
 */
export function evaluateFiveHourBreakRule(tape: AmiTape): {
  workMinutesInWindow: number;
  slots: AmiRestSlots;
  restComplete: boolean;
} {
  const { kinds } = tape;
  let lastWork = -1;
  for (let i = kinds.length - 1; i >= 0; i--) {
    if (kinds[i] === "work") {
      lastWork = i;
      break;
    }
  }
  const slots: AmiRestSlots = { slot1: false, slot2: false };
  if (lastWork < 0) {
    return { workMinutesInWindow: 0, slots, restComplete: true };
  }

  let remaining = AMI_WORK_WINDOW;
  let windowStart = lastWork;
  for (let i = lastWork; i >= 0 && remaining > 0; i--) {
    if (kinds[i] === "work") {
      remaining -= 1;
      windowStart = i;
    }
  }
  // Breaks between windowStart and lastWork inclusive (same work block span)
  const endExclusive = lastWork + 1;
  const breakRuns = continuousRuns(kinds, "break", windowStart, endExclusive);
  for (const run of breakRuns) applyQualifyingBreakToSlots(run.length, slots);
  const workMinutesInWindow = countKind(kinds, "work", windowStart, endExclusive);
  return {
    workMinutesInWindow,
    slots,
    restComplete: qualifyingRestComplete(slots) || workMinutesInWindow < AMI_WORK_WINDOW,
  };
}

// —— Solo 17h episode + between-shift 7h ——

export type AmiSeventeenHourStatus = {
  anchorMinute: number | null;
  workBreakMinutesSinceAnchor: number;
  workBreakMinutesRemaining: number;
  withinSeventeenHourEpisode: boolean;
  canResumeWithoutSevenHourRest: boolean;
};

export function evaluateSeventeenHourEpisode(
  events: AmiEvent[],
  asOfMs: number
): AmiSeventeenHourStatus {
  const tape = buildEvalTape(events, asOfMs, AMI_17H_LOOKBACK);
  const segs = segmentsFromTape(tape);

  let anchorMinute: number | null = null;
  let nonWorkRun = 0;
  for (const seg of segs) {
    if (seg.kind === "non_work") {
      nonWorkRun += seg.endMinute - seg.startMinute;
    } else {
      if (nonWorkRun >= AMI_NON_WORK_ANCHOR) {
        anchorMinute = seg.startMinute;
      }
      nonWorkRun = 0;
    }
  }

  let used = 0;
  if (anchorMinute != null) {
    for (const seg of segs) {
      if (seg.endMinute <= anchorMinute) continue;
      if (seg.kind === "work" || seg.kind === "break") {
        const start = Math.max(seg.startMinute, anchorMinute);
        used += seg.endMinute - start;
      }
    }
  }

  const within = anchorMinute != null && used < AMI_17H_WORK_BREAK_CEILING;
  const last = lastAmiEventAt(events, asOfMs);
  const canResume = within && last?.type === "stop";

  return {
    anchorMinute,
    workBreakMinutesSinceAnchor: used,
    workBreakMinutesRemaining: Math.max(0, AMI_17H_WORK_BREAK_CEILING - used),
    withinSeventeenHourEpisode: within,
    canResumeWithoutSevenHourRest: canResume,
  };
}

/**
 * Solo between-shift rest: minutes of non_work on reclassified tape since last stop/non_work
 * marker event — with 17h episode resume exception (kept).
 */
export function evaluateSoloBetweenShiftRest(
  events: AmiEvent[],
  asOfMs: number
): {
  required: number;
  nonWorkMinutesSinceMarker: number | null;
  met: boolean;
  waivedBySeventeenHourResume: boolean;
} {
  const episode = evaluateSeventeenHourEpisode(events, asOfMs);
  if (episode.canResumeWithoutSevenHourRest) {
    return {
      required: AMI_SOLO_BETWEEN_SHIFT_REST,
      nonWorkMinutesSinceMarker: null,
      met: true,
      waivedBySeventeenHourResume: true,
    };
  }

  const sorted = sortAmiEvents(events);
  let markerMs: number | null = null;
  for (const ev of sorted) {
    const t = eventTimeMs(ev);
    if (t > asOfMs) break;
    if (ev.type === "stop" || ev.type === "non_work") markerMs = t;
  }
  if (markerMs == null) {
    return {
      required: AMI_SOLO_BETWEEN_SHIFT_REST,
      nonWorkMinutesSinceMarker: null,
      met: true,
      waivedBySeventeenHourResume: false,
    };
  }

  const tape = buildEvalTape(events, asOfMs, AMI_17H_LOOKBACK);
  const startMin = Math.max(0, Math.floor((markerMs - tape.originMs) / 60_000));
  const nonWork = countKind(tape.kinds, "non_work", startMin, tape.kinds.length);
  return {
    required: AMI_SOLO_BETWEEN_SHIFT_REST,
    nonWorkMinutesSinceMarker: nonWork,
    met: nonWork >= AMI_SOLO_BETWEEN_SHIFT_REST,
    waivedBySeventeenHourResume: false,
  };
}

// —— Solo 72h ——

export type AmiSolo72hResult = {
  totalNonWork: number;
  qualBlockCount: number;
  maxGapBetweenQualBlocks: number | null;
  totalNonWorkOk: boolean;
  qualBlockCountOk: boolean;
  gapOk: boolean;
};

export function evaluateSolo72h(tape: AmiTape): AmiSolo72hResult {
  const from = Math.max(0, tape.kinds.length - AMI_72H_WINDOW);
  const kinds = tape.kinds;
  const totalNonWork = countKind(kinds, "non_work", from);
  const qual = continuousRuns(kinds, "non_work", from).filter((r) => r.length >= AMI_72H_QUAL_BLOCK);
  let maxGap: number | null = null;
  for (let i = 1; i < qual.length; i++) {
    const gap = qual[i]!.start - qual[i - 1]!.end;
    if (maxGap == null || gap > maxGap) maxGap = gap;
  }
  return {
    totalNonWork,
    qualBlockCount: qual.length,
    maxGapBetweenQualBlocks: maxGap,
    totalNonWorkOk: totalNonWork >= AMI_72H_MIN_TOTAL_NON_WORK,
    qualBlockCountOk: qual.length >= AMI_72H_QUAL_BLOCK_COUNT,
    gapOk: maxGap == null || maxGap <= AMI_72H_MAX_GAP_BETWEEN_QUAL_BLOCKS,
  };
}

// —— 168h / 14-day work ——

export type Ami168hResult = {
  maxRollingWorkMinutes: number;
  inWarningBand: boolean;
  wouldExceed168: boolean;
};

export function evaluate168hWork(tape: AmiTape): Ami168hResult {
  const { kinds } = tape;
  // Split on ≥48h continuous non_work resets
  const segments: Array<{ start: number; end: number }> = [];
  let segStart = 0;
  let run = 0;
  let runStart = 0;
  for (let i = 0; i <= kinds.length; i++) {
    const isNw = i < kinds.length && kinds[i] === "non_work";
    if (isNw) {
      if (run === 0) runStart = i;
      run += 1;
      continue;
    }
    if (run >= AMI_168H_RESET_NON_WORK && segStart < runStart) {
      segments.push({ start: segStart, end: runStart });
      segStart = i;
    }
    run = 0;
  }
  if (segStart < kinds.length) segments.push({ start: segStart, end: kinds.length });

  let maxWork = 0;
  for (const seg of segments) {
    const slice = kinds.slice(seg.start, seg.end);
    if (slice.length < AMI_14D_WINDOW) {
      maxWork = Math.max(maxWork, countKind(slice, "work"));
      continue;
    }
    // rolling window
    let windowWork = countKind(slice, "work", 0, AMI_14D_WINDOW);
    maxWork = Math.max(maxWork, windowWork);
    for (let start = 1; start <= slice.length - AMI_14D_WINDOW; start++) {
      if (slice[start - 1] === "work") windowWork -= 1;
      if (slice[start + AMI_14D_WINDOW - 1] === "work") windowWork += 1;
      if (windowWork > maxWork) maxWork = windowWork;
    }
  }

  return {
    maxRollingWorkMinutes: maxWork,
    inWarningBand: maxWork >= AMI_168H_WARN_WORK && maxWork <= AMI_168H_MAX_WORK,
    wouldExceed168: maxWork > AMI_168H_MAX_WORK,
  };
}

// —— Solo 14-day ≥2×24h non_work ——

export function evaluateSolo14dLongRests(tape: AmiTape): {
  longRestCount: number;
  ok: boolean;
} {
  const from = Math.max(0, tape.kinds.length - AMI_14D_WINDOW);
  const longs = continuousRuns(tape.kinds, "non_work", from).filter(
    (r) => r.length >= AMI_14D_LONG_REST_BLOCK
  );
  return {
    longRestCount: longs.length,
    ok: longs.length >= AMI_14D_LONG_REST_COUNT,
  };
}

// —— Two-up ——

export function evaluateTwoUp24hRest(tape: AmiTape): {
  nonWorkMinutes: number;
  workOrBreakMinutes: number;
  shortfall: number;
  applies: boolean;
  met: boolean;
} {
  const from = Math.max(0, tape.kinds.length - AMI_TWO_UP_24H_WINDOW);
  let nonWork = 0;
  let workOrBreak = 0;
  for (let i = from; i < tape.kinds.length; i++) {
    const k = tape.kinds[i]!;
    if (k === "non_work") nonWork += 1;
    else workOrBreak += 1;
  }
  if (workOrBreak === 0) {
    return { nonWorkMinutes: nonWork, workOrBreakMinutes: 0, shortfall: 0, applies: false, met: true };
  }
  const shortfall = Math.max(0, AMI_TWO_UP_24H_MIN_NON_WORK - nonWork);
  return {
    nonWorkMinutes: nonWork,
    workOrBreakMinutes: workOrBreak,
    shortfall,
    applies: true,
    met: shortfall === 0,
  };
}

export function evaluateTwoUp48hOption(tape: AmiTape): { hasQualBlock: boolean } {
  const from = Math.max(0, tape.kinds.length - AMI_48H_WINDOW);
  const ok = continuousRuns(tape.kinds, "non_work", from).some(
    (r) => r.length >= AMI_48H_MIN_CONTINUOUS_NON_WORK
  );
  return { hasQualBlock: ok };
}

export function evaluateTwoUp7dOption(tape: AmiTape): {
  totalNonWork: number;
  has24hBlock: boolean;
  hasSubMinPiece: boolean;
  structureOk: boolean;
} {
  const from = Math.max(0, tape.kinds.length - AMI_7D_WINDOW);
  const totalNonWork = countKind(tape.kinds, "non_work", from);
  const runs = continuousRuns(tape.kinds, "non_work", from);
  const has24hBlock = runs.some((r) => r.length >= AMI_7D_MIN_CONTINUOUS_BLOCK);
  const hasSubMinPiece = runs.some((r) => r.length > 0 && r.length < AMI_7D_MIN_NON_WORK_PIECE);
  const structureOk =
    totalNonWork >= AMI_7D_MIN_TOTAL_NON_WORK && has24hBlock && !hasSubMinPiece;
  return { totalNonWork, has24hBlock, hasSubMinPiece, structureOk };
}

// —— Reg 184E(4) pattern-change rest ——

/**
 * Primary (Phase 1 lock): only `work` interrupts the 24h pattern-change rest run.
 * `break` and `non_work` both count.
 */
export function measurePatternChangeRestOnlyWorkInterrupts(
  tape: AmiTape,
  fromMinute: number,
  toMinuteExclusive: number
): number {
  const start = Math.max(0, fromMinute);
  const end = Math.min(tape.kinds.length, toMinuteExclusive);
  // Consecutive non-work+break ending immediately before next work (toMinute).
  let trailing = 0;
  for (let i = end - 1; i >= start; i--) {
    if (tape.kinds[i] === "work") break;
    trailing += 1;
  }
  return trailing;
}

/** Strict continuous non_work only (comparison variant). */
export function measurePatternChangeRestContinuousNonWork(
  tape: AmiTape,
  fromMinute: number,
  toMinuteExclusive: number
): number {
  const start = Math.max(0, fromMinute);
  const end = Math.min(tape.kinds.length, toMinuteExclusive);
  let trailing = 0;
  for (let i = end - 1; i >= start; i--) {
    if (tape.kinds[i] !== "non_work") break;
    trailing += 1;
  }
  return trailing;
}

export function patternChangeRestMet(
  restMinutes: number,
  required: number = AMI_PATTERN_CHANGE_REST
): boolean {
  return restMinutes >= required;
}

export { AMI_PATTERN_CHANGE_REST };
