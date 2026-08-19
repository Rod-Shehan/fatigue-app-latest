/**
 * Phase 2 — dual-run: current rule engines vs AMI evaluators on shared fixtures.
 * Does not wire AMI into production. Produces structured comparison rows.
 */

import { deriveDaysWithRollover } from "@/components/fatigue/EventLogger";
import type { ComplianceDayData } from "@/lib/compliance";
import {
  findWorkWindowStartMs,
  getRestSlotsForBreakRange,
  qualifyingRestComplete,
} from "@/lib/five-hour-break-rule";
import { computeRolling168hMetricsFromDays } from "@/lib/rolling-168h-metrics";
import {
  getShiftRestStatusFromTimeline,
  getTwoUpRolling24hRestStatus,
} from "@/lib/rolling-events";
import { getSeventeenHourEpisodeStatus } from "@/lib/seventeen-hour-episode";
import { findShiftPatternTransitionsOnTimeline } from "@/lib/shift-change";
import { countFullNonWorkPeriods } from "@/lib/declared-24h-rests";
import { getSheetDayDateString, parseLocalDate } from "@/lib/weeks";
import {
  AMI_14D_WINDOW,
  AMI_17H_LOOKBACK,
  AMI_72H_EVAL_LOOKBACK,
  AMI_72H_WINDOW,
  AMI_PATTERN_CHANGE_REST,
  AMI_14D_LONG_REST_BLOCK,
} from "./constants";
import {
  buildEvalTape,
  evaluate168hWork,
  evaluateFiveHourBreakRule,
  evaluateSeventeenHourEpisode,
  evaluateSolo14dLongRests,
  evaluateSolo72h,
  evaluateSoloBetweenShiftRest,
  evaluateTwoUp24hRest,
  measurePatternChangeRestContinuousNonWork,
  measurePatternChangeRestOnlyWorkInterrupts,
  patternChangeRestMet,
} from "./evaluate";
import { legacySolo72hWindowMetrics } from "./legacy-flat-metrics";
import type { AmiEvent } from "./types";

export type DualRunStatus = "match" | "diff" | "skip";

export type DualRunRow = {
  fixtureId: string;
  rule: string;
  status: DualRunStatus;
  current: Record<string, unknown>;
  ami: Record<string, unknown>;
  note?: string;
};

export type DualRunFixture = {
  id: string;
  label: string;
  events: AmiEvent[];
  asOfIso: string;
  /** Optional weekStarting (YYYY-MM-DD Sunday) for day-grid rules (168h, shift pattern). */
  weekStarting?: string;
  /** Optional A/B labels per day index 0–6 for shift-pattern fixtures. */
  shiftLabels?: Array<"A" | "B" | "" | undefined>;
};

function asOfMs(fixture: DualRunFixture): number {
  return new Date(fixture.asOfIso).getTime();
}

function recordStartMsFromWeek(weekStarting?: string): number | undefined {
  if (!weekStarting) return undefined;
  const ms = parseLocalDate(weekStarting).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

function toTimelineEvents(events: AmiEvent[]) {
  return events.map((e) => ({ time: e.time, type: e.type }));
}

/** Place events onto a 7-day sheet and derive coverage the same way the app does. */
export function eventsToDerivedDays(
  events: AmiEvent[],
  weekStarting: string,
  todayStr: string,
  shiftLabels?: DualRunFixture["shiftLabels"]
): ComplianceDayData[] {
  const buckets: ComplianceDayData[] = Array.from({ length: 7 }, (_, i) => ({
    events: [],
    shift_label: shiftLabels?.[i] ?? "",
  }));
  for (const ev of events) {
    const ymd = ev.time.slice(0, 10);
    for (let i = 0; i < 7; i++) {
      if (getSheetDayDateString(weekStarting, i) === ymd) {
        buckets[i]!.events = [...(buckets[i]!.events ?? []), { time: ev.time, type: ev.type }];
        break;
      }
    }
  }
  return deriveDaysWithRollover(buckets, weekStarting, { todayStr });
}

function compareBool(a: boolean, b: boolean): DualRunStatus {
  return a === b ? "match" : "diff";
}

function compareNum(a: number, b: number, tol = 0): DualRunStatus {
  return Math.abs(a - b) <= tol ? "match" : "diff";
}

export function compareSeventeenHour(fixture: DualRunFixture): DualRunRow {
  const asOf = asOfMs(fixture);
  const events = toTimelineEvents(fixture.events);
  const current = getSeventeenHourEpisodeStatus(events, asOf);
  const ami = evaluateSeventeenHourEpisode(fixture.events, asOf);
  const status =
    compareBool(current.canResumeWithoutSevenHourRest, ami.canResumeWithoutSevenHourRest) ===
      "match" &&
    compareBool(current.withinSeventeenHourEpisode, ami.withinSeventeenHourEpisode) === "match" &&
    compareNum(current.workBreakMinutesSinceAnchor, ami.workBreakMinutesSinceAnchor, 1) === "match"
      ? "match"
      : "diff";
  return {
    fixtureId: fixture.id,
    rule: "seventeen_hour_episode",
    status,
    current: {
      within: current.withinSeventeenHourEpisode,
      used: current.workBreakMinutesSinceAnchor,
      canResume: current.canResumeWithoutSevenHourRest,
    },
    ami: {
      within: ami.withinSeventeenHourEpisode,
      used: ami.workBreakMinutesSinceAnchor,
      canResume: ami.canResumeWithoutSevenHourRest,
    },
  };
}

export function compareSoloBetweenShift(fixture: DualRunFixture): DualRunRow {
  const asOf = asOfMs(fixture);
  const events = toTimelineEvents(fixture.events);
  const currentStatus = getShiftRestStatusFromTimeline(events, asOf);
  const ami = evaluateSoloBetweenShiftRest(fixture.events, asOf);
  // Current returns null when waived (17h resume) or no marker — treat null as met for gate.
  const currentGateMet =
    getSeventeenHourEpisodeStatus(events, asOf).canResumeWithoutSevenHourRest ||
    currentStatus == null ||
    currentStatus.consecutiveNonWorkMinutes >= 420;
  const status = compareBool(currentGateMet, ami.met);
  return {
    fixtureId: fixture.id,
    rule: "solo_between_shift_7h",
    status,
    current: {
      consecutiveNonWorkMinutes: currentStatus?.consecutiveNonWorkMinutes ?? null,
      gateMet: currentGateMet,
    },
    ami: {
      nonWorkMinutesSinceMarker: ami.nonWorkMinutesSinceMarker,
      met: ami.met,
      waived: ami.waivedBySeventeenHourResume,
    },
    note:
      status === "diff"
        ? "Current measures wall-clock since stop/non_work marker; AMI counts non_work minutes on reclassified tape"
        : undefined,
  };
}

export function compareTwoUp24h(fixture: DualRunFixture): DualRunRow {
  const asOf = asOfMs(fixture);
  const current = getTwoUpRolling24hRestStatus(toTimelineEvents(fixture.events), asOf);
  const tape = buildEvalTape(fixture.events, asOf, 2 * 24 * 60);
  const ami = evaluateTwoUp24hRest(tape);
  const currentMet = current == null || current.nonWorkMinutesShortfall === 0;
  const status =
    compareBool(currentMet, ami.met) === "match" &&
    (current == null
      ? !ami.applies || ami.met
      : compareNum(current.nonWorkMinutes, ami.nonWorkMinutes, 2) === "match")
      ? "match"
      : "diff";
  return {
    fixtureId: fixture.id,
    rule: "two_up_24h",
    status,
    current: current
      ? {
          nonWork: current.nonWorkMinutes,
          shortfall: current.nonWorkMinutesShortfall,
          met: currentMet,
        }
      : { met: true, applies: false },
    ami: {
      nonWork: ami.nonWorkMinutes,
      shortfall: ami.shortfall,
      met: ami.met,
      applies: ami.applies,
    },
    note:
      status === "diff"
        ? "Current uses event-segment kinds; AMI uses reclassified absolute tape"
        : undefined,
  };
}

export function compareFiveHour(fixture: DualRunFixture): DualRunRow {
  const asOf = asOfMs(fixture);
  const events = toTimelineEvents(fixture.events);
  const windowStart = findWorkWindowStartMs(events, asOf);
  let currentComplete = true;
  let currentSlots = { slot1: false, slot2: false };
  if (windowStart != null) {
    currentSlots = getRestSlotsForBreakRange(events, windowStart, asOf);
    currentComplete = qualifyingRestComplete(currentSlots);
  }
  const tape = buildEvalTape(fixture.events, asOf, AMI_17H_LOOKBACK);
  const ami = evaluateFiveHourBreakRule(tape);
  const status = compareBool(currentComplete, ami.restComplete);
  return {
    fixtureId: fixture.id,
    rule: "five_hour_break",
    status,
    current: { restComplete: currentComplete, slots: currentSlots, windowStart },
    ami: {
      restComplete: ami.restComplete,
      slots: ami.slots,
      workMinutesInWindow: ami.workMinutesInWindow,
    },
    note:
      status === "diff"
        ? "Current scores break events in work-minute window; AMI scores break and non-work rest the same after reclass"
        : undefined,
  };
}

export function compare168h(fixture: DualRunFixture): DualRunRow {
  if (!fixture.weekStarting) {
    return {
      fixtureId: fixture.id,
      rule: "work_168h",
      status: "skip",
      current: {},
      ami: {},
      note: "Needs weekStarting",
    };
  }
  const asOf = asOfMs(fixture);
  const todayStr = fixture.asOfIso.slice(0, 10);
  const days = eventsToDerivedDays(fixture.events, fixture.weekStarting, todayStr, fixture.shiftLabels);
  const current = computeRolling168hMetricsFromDays(days);
  const tape = buildEvalTape(fixture.events, asOf, AMI_14D_WINDOW + AMI_72H_WINDOW, {
    recordStartMs: recordStartMsFromWeek(fixture.weekStarting),
  });
  const ami = evaluate168hWork(tape);
  const amiHours = Math.round((ami.maxRollingWorkMinutes / 60) * 10) / 10;
  const status =
    compareBool(current.wouldExceed168, ami.wouldExceed168) === "match" &&
    compareBool(current.inWarningBand, ami.inWarningBand) === "match" &&
    // Day-grid carry vs absolute tape can differ by several hours; gate on bands first.
    compareNum(current.maxRollingWorkHours, amiHours, 15) === "match"
      ? "match"
      : "diff";
  return {
    fixtureId: fixture.id,
    rule: "work_168h",
    status,
    current: {
      maxHours: current.maxRollingWorkHours,
      warn: current.inWarningBand,
      exceed: current.wouldExceed168,
    },
    ami: {
      maxHours: amiHours,
      warn: ami.inWarningBand,
      exceed: ami.wouldExceed168,
      maxMinutes: ami.maxRollingWorkMinutes,
    },
  };
}

export function compareSolo72h(fixture: DualRunFixture): DualRunRow {
  const asOf = asOfMs(fixture);
  const tape = buildEvalTape(fixture.events, asOf, AMI_72H_EVAL_LOOKBACK);
  const ami = evaluateSolo72h(tape);

  if (!fixture.weekStarting) {
    return {
      fixtureId: fixture.id,
      rule: "solo_72h",
      status: "skip",
      current: { note: "Needs weekStarting + current day offset for legacy window" },
      ami: {
        applies: ami.applies,
        totalNonWork: ami.totalNonWork,
        qualBlockCount: ami.qualBlockCount,
        gapOk: ami.gapOk,
      },
    };
  }

  const todayStr = fixture.asOfIso.slice(0, 10);
  const days = eventsToDerivedDays(fixture.events, fixture.weekStarting, todayStr, fixture.shiftLabels);
  const nonWork = days.flatMap((d) => d.non_work ?? []);
  // Treat asOf as end of "today" on the sheet: find day index matching asOf date
  let currentDayIndex = 0;
  for (let i = 0; i < 7; i++) {
    if (getSheetDayDateString(fixture.weekStarting, i) === todayStr) {
      currentDayIndex = i;
      break;
    }
  }
  const [y, m, d] = todayStr.split("-").map(Number);
  const dayStart = new Date(y!, m! - 1, d!).getTime();
  const slotOffset = Math.min(1440, Math.max(0, Math.floor((asOf - dayStart) / 60_000)));
  const effectiveEndMinute = currentDayIndex * 1440 + slotOffset;
  const legacy = legacySolo72hWindowMetrics(nonWork, effectiveEndMinute);
  if (!legacy) {
    return {
      fixtureId: fixture.id,
      rule: "solo_72h",
      status: ami.applies ? "diff" : "match",
      current: { note: "effectiveEnd < 72h of flat coverage / soft-reset skip", applies: false },
      ami: {
        applies: ami.applies,
        totalNonWork: ami.totalNonWork,
        qualBlockCount: ami.qualBlockCount,
      },
      note: ami.applies
        ? "Legacy skipped short segment; AMI still applies — investigate soft-reset parity"
        : "Both inactive (segment < 72h or equivalent)",
    };
  }
  if (!ami.applies) {
    return {
      fixtureId: fixture.id,
      rule: "solo_72h",
      status: "diff",
      current: {
        totalNonWorkMinutes: legacy.totalNonWorkMinutes,
        sevenHourBlocks: legacy.sevenHourBlockCount,
      },
      ami: { applies: false, totalNonWork: ami.totalNonWork, qualBlockCount: ami.qualBlockCount },
      note: "Legacy scored window; AMI soft-reset inactive — investigate parity",
    };
  }
  const status =
    compareNum(legacy.totalNonWorkMinutes, ami.totalNonWork, 60) === "match" &&
    compareNum(legacy.sevenHourBlockCount, ami.qualBlockCount, 0) === "match"
      ? "match"
      : "diff";
  return {
    fixtureId: fixture.id,
    rule: "solo_72h",
    status,
    current: {
      totalNonWorkMinutes: legacy.totalNonWorkMinutes,
      sevenHourBlocks: legacy.sevenHourBlockCount,
    },
    ami: {
      applies: ami.applies,
      totalNonWork: ami.totalNonWork,
      qualBlockCount: ami.qualBlockCount,
      maxGap: ami.maxGapBetweenQualBlocks,
    },
    note:
      status === "diff"
        ? "Legacy day-grid vs AMI absolute tape after 24h soft-reset"
        : undefined,
  };
}

export function compareSolo14dRests(fixture: DualRunFixture): DualRunRow {
  const asOf = asOfMs(fixture);
  const tape = buildEvalTape(fixture.events, asOf, AMI_14D_WINDOW, {
    recordStartMs: recordStartMsFromWeek(fixture.weekStarting),
  });
  const ami = evaluateSolo14dLongRests(tape);

  if (!fixture.weekStarting) {
    return {
      fixtureId: fixture.id,
      rule: "solo_14d_long_rests",
      status: "skip",
      current: { note: "Needs weekStarting" },
      ami: { longRestCount: ami.longRestCount, ok: ami.ok },
    };
  }

  const todayStr = fixture.asOfIso.slice(0, 10);
  const days = eventsToDerivedDays(fixture.events, fixture.weekStarting, todayStr, fixture.shiftLabels);
  const nonWork = days.flatMap((d) => d.non_work ?? []);
  const from = Math.max(0, nonWork.length - AMI_14D_WINDOW);
  const legacyCount = countFullNonWorkPeriods(nonWork.slice(from), AMI_14D_LONG_REST_BLOCK);
  const status = compareNum(legacyCount, ami.longRestCount, 0);
  return {
    fixtureId: fixture.id,
    rule: "solo_14d_long_rests",
    status,
    current: { longRestCount: legacyCount },
    ami: { longRestCount: ami.longRestCount, ok: ami.ok },
  };
}

export function compareShiftPatternGap(fixture: DualRunFixture): DualRunRow {
  if (!fixture.weekStarting) {
    return {
      fixtureId: fixture.id,
      rule: "shift_pattern_184E4_gap",
      status: "skip",
      current: {},
      ami: {},
      note: "Needs weekStarting + shiftLabels",
    };
  }
  const asOf = asOfMs(fixture);
  const todayStr = fixture.asOfIso.slice(0, 10);
  const days = eventsToDerivedDays(
    fixture.events,
    fixture.weekStarting,
    todayStr,
    fixture.shiftLabels
  );
  const transitions = findShiftPatternTransitionsOnTimeline(days);
  const last = transitions[transitions.length - 1];
  if (!last) {
    return {
      fixtureId: fixture.id,
      rule: "shift_pattern_184E4_gap",
      status: "skip",
      current: { transitions: 0 },
      ami: {},
      note: "No A↔B transition on fixture",
    };
  }
  const currentGapMin = Math.round(last.gapHours * 60);
  const tape = buildEvalTape(fixture.events, asOf, AMI_PATTERN_CHANGE_REST * 3);
  const stopMin = Math.max(0, Math.floor((last.stopTimeMs - tape.originMs) / 60_000));
  const workMin = Math.max(0, Math.floor((last.workTimeMs - tape.originMs) / 60_000));
  const onlyWork = measurePatternChangeRestOnlyWorkInterrupts(tape, stopMin, workMin);
  const pureNw = measurePatternChangeRestContinuousNonWork(tape, stopMin, workMin);
  const currentMet = currentGapMin >= AMI_PATTERN_CHANGE_REST;
  const onlyWorkMet = patternChangeRestMet(onlyWork);
  const pureNwMet = patternChangeRestMet(pureNw);
  // Compare current (wall-clock) to AMI only-work-interrupts (Phase 1 primary)
  const status = compareBool(currentMet, onlyWorkMet);
  return {
    fixtureId: fixture.id,
    rule: "shift_pattern_184E4_gap",
    status,
    current: {
      gapMinutes: currentGapMin,
      met: currentMet,
      method: "stop_to_work_elapsed",
    },
    ami: {
      onlyWorkInterruptsMinutes: onlyWork,
      onlyWorkMet,
      continuousNonWorkMinutes: pureNw,
      continuousNonWorkMet: pureNwMet,
    },
    note:
      currentMet !== pureNwMet
        ? "Wall-clock/current and only-work-interrupts may agree while continuous-non_work differs when breaks sit in the gap"
        : undefined,
  };
}

export const DUAL_RUN_COMPARATORS = [
  compareSeventeenHour,
  compareSoloBetweenShift,
  compareTwoUp24h,
  compareFiveHour,
  compare168h,
  compareSolo72h,
  compareSolo14dRests,
  compareShiftPatternGap,
] as const;

export function runDualRunFixture(fixture: DualRunFixture): DualRunRow[] {
  return DUAL_RUN_COMPARATORS.map((fn) => fn(fixture));
}

export function summarizeDualRun(rows: DualRunRow[]): {
  match: number;
  diff: number;
  skip: number;
  rows: DualRunRow[];
} {
  return {
    match: rows.filter((r) => r.status === "match").length,
    diff: rows.filter((r) => r.status === "diff").length,
    skip: rows.filter((r) => r.status === "skip").length,
    rows,
  };
}

export function formatDualRunMarkdown(
  fixtures: DualRunFixture[],
  allRows: DualRunRow[]
): string {
  const lines: string[] = [
    "# AMI dual-run report (Phase 2)",
    "",
    `Generated against ${fixtures.length} fixtures. Live WA compliance uses the AMI overlay by default (kill-switch: \`AMI_COMPLIANCE_ENGINE_ENABLED=false\`).`,
    "",
    "## Summary",
    "",
  ];
  const summary = summarizeDualRun(allRows);
  lines.push(`- **match:** ${summary.match}`);
  lines.push(`- **diff:** ${summary.diff}`);
  lines.push(`- **skip:** ${summary.skip} (current rule not extracted as a pure function yet)`);
  lines.push("");
  lines.push("## Rows");
  lines.push("");
  lines.push("| Fixture | Rule | Status | Notes |");
  lines.push("|---------|------|--------|-------|");
  for (const r of allRows) {
    const note = (r.note ?? "").replace(/\|/g, "/");
    lines.push(`| ${r.fixtureId} | ${r.rule} | ${r.status} | ${note} |`);
  }
  lines.push("");
  lines.push("## Diff details");
  lines.push("");
  for (const r of allRows.filter((x) => x.status === "diff")) {
    lines.push(`### ${r.fixtureId} — ${r.rule}`);
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify({ current: r.current, ami: r.ami, note: r.note }, null, 2));
    lines.push("```");
    lines.push("");
  }
  lines.push("## Locked decisions so far");
  lines.push("");
  lines.push("- Keep 17h episode resume after End shift");
  lines.push("- Keep NHVR provisional engine");
  lines.push("- 184E(4) primary AMI measure: only `work` interrupts rest run");
  lines.push("- Parity vs AMI-literal: decide from this report (still open)");
  lines.push("- Phase 3: AMI overlay via getComplianceEngine — **on by default** (kill-switch AMI_COMPLIANCE_ENGINE_ENABLED=false)");
  lines.push("");
  return lines.join("\n");
}
