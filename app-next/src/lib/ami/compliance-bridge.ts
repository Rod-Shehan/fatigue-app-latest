/**
 * WA compliance bridge: AMI overlay (default on; kill-switch via flag).
 * Keep legacy results that AMI does not own; replace AMI-owned families with AMI evaluations.
 */

import type { ComplianceCheckResult, ComplianceDayData } from "@/lib/compliance";
import { runComplianceChecks } from "@/lib/compliance";
import {
  collectDeclared24hRests,
  timelineStartYmdFromPriorDays,
} from "@/lib/declared-24h-rests";
import { getEventsInTimeOrder } from "@/lib/rolling-events";
import { toAmiEventType } from "@/lib/activity-kind";
import { getPerthMidnightUtcMs, getSheetDayDateString } from "@/lib/weeks";
import {
  AMI_14D_WINDOW,
  AMI_28D_WINDOW,
  AMI_72H_EVAL_LOOKBACK,
  AMI_72H_WINDOW,
  AMI_PATTERN_CHANGE_REST,
} from "./constants";
import {
  buildEvalTape,
  evaluate168hWork,
  evaluateFiveHourBreakRule,
  evaluateSolo184E2bRestOptions,
  evaluateSolo72h,
  evaluateTwoUp24hRest,
} from "./evaluate";
import {
  fiveHourViolationDayAttribution,
  formatFiveHourViolationMessage,
} from "./five-hour-message";
import { isAmiComplianceEngineEnabled } from "./flag";
import { tapeMinuteToMs } from "./paint";
import type { AmiEvent } from "./types";
import {
  scoreTwoUp184E3b,
  TWO_UP_184E3B_FAIL_MESSAGE,
  twoUp184E3bStructureWarnings,
  type StationaryGeoEvent,
} from "@/lib/two-up-stationary";

type RunOpts = Parameters<typeof runComplianceChecks>[1];

const AMI_OWNED_MESSAGE_MARKERS = [
  "20 min rest per 5h work",
  "More than 5h work without valid break",
  "Need ≥27 hrs non-work in any rolling 72hr",
  "Need ≥3 blocks of ≥7 continuous hrs non-work in any rolling 72hrs",
  "Two ≥7h non-work periods cannot be separated by more than 17h",
  "14-day work exceeds 168h",
  "approaching 168h limit",
  "Need ≥2×24h continuous non-work",
  "Rolling 14-day non-work gap detected",
  "Need ≥7h non-work in any rolling 24h period (Two-Up)",
  "Need ≥48 hrs non-work in any 7-day period",
  "48hrs non-work must include ≥24 continuous hrs",
  "Non-work time must not include a period of less than 7 consecutive hours — Two-Up",
  "Need ≥7h continuous non-work in any rolling 48h",
  "Need ≥7h continuous GPS-proven Parked or End shift",
];

function isAmiOwnedResult(r: ComplianceCheckResult): boolean {
  return AMI_OWNED_MESSAGE_MARKERS.some((m) => r.message.includes(m));
}

function collectAmiEvents(
  days: ComplianceDayData[],
  options: RunOpts
): AmiEvent[] {
  const slices: ComplianceDayData[] = [
    ...((options.historyDays as ComplianceDayData[] | null | undefined) ?? []),
    ...((options.prevWeekDays as ComplianceDayData[] | null | undefined) ?? []),
    ...days,
  ];
  return getEventsInTimeOrder(slices)
    .filter((e) => e.driver !== "second")
    .map((e) => ({
      time: e.time,
      type: toAmiEventType(e.type),
    }))
    .filter((e): e is { time: string; type: AmiEvent["type"] } => e.type != null);
}

function collectStationaryGeoEvents(
  days: ComplianceDayData[],
  options: RunOpts
): StationaryGeoEvent[] {
  const slices: ComplianceDayData[] = [
    ...((options.historyDays as ComplianceDayData[] | null | undefined) ?? []),
    ...((options.prevWeekDays as ComplianceDayData[] | null | undefined) ?? []),
    ...days,
  ];
  return getEventsInTimeOrder(slices)
    .filter((e) => e.driver !== "second")
    .map((e) => ({
      time: e.time,
      type: e.type,
      lat: e.lat,
      lng: e.lng,
    }));
}

function resolveAsOfMs(options: RunOpts): number {
  const { weekStarting, currentDayIndex, slotOffsetWithinToday } = options;
  if (
    weekStarting &&
    currentDayIndex != null &&
    currentDayIndex >= 0 &&
    currentDayIndex <= 6 &&
    slotOffsetWithinToday != null
  ) {
    const ymd = getSheetDayDateString(weekStarting, currentDayIndex);
    // Slot offset is minutes since 00:00 on the WA regulatory day
    // (getSlotOffsetWithinTodayLocal). Adding that onto the host's 00:00
    // (Vercel is +00:00) stretched a 10:51 start into an 8h+ work block.
    const start = getPerthMidnightUtcMs(ymd);
    return start + Math.min(1440, Math.max(0, slotOffsetWithinToday)) * 60_000;
  }
  return Date.now();
}

/** 00:00 of the first loaded sheet day (history + prev week + current). */
function resolveRecordStartMs(options: RunOpts): number | undefined {
  const weekStarting = options.weekStarting;
  if (!weekStarting) return undefined;
  const priorDayCount =
    ((options.historyDays as unknown[] | null | undefined)?.length ?? 0) +
    ((options.prevWeekDays as unknown[] | null | undefined)?.length ?? 0);
  const startYmd = timelineStartYmdFromPriorDays(weekStarting, priorDayCount);
  const ms = getPerthMidnightUtcMs(startYmd);
  return Number.isFinite(ms) ? ms : undefined;
}

function buildAmiOwnedResults(
  days: ComplianceDayData[],
  options: RunOpts
): ComplianceCheckResult[] {
  const events = collectAmiEvents(days, options);
  const asOf = resolveAsOfMs(options);
  const recordStartMs = resolveRecordStartMs(options);
  const driverType = options.driverType ?? "solo";
  const out: ComplianceCheckResult[] = [];

  const tapeShort = buildEvalTape(events, asOf, Math.max(AMI_72H_WINDOW, 24 * 60));
  const five = evaluateFiveHourBreakRule(tapeShort);
  if (!five.restComplete && five.workMinutesInWindow >= 300 && five.lastWorkMinute >= 0) {
    const lastWorkMs = tapeMinuteToMs(tapeShort, five.lastWorkMinute + 1);
    const windowStartMs = tapeMinuteToMs(tapeShort, five.windowStartMinute);
    const attr = fiveHourViolationDayAttribution(lastWorkMs, options.weekStarting);
    out.push({
      type: "violation",
      iconKey: "AlertTriangle",
      day: attr.day,
      scrollDayIndex: attr.scrollDayIndex,
      message: formatFiveHourViolationMessage({
        workMinutesInWindow: five.workMinutesInWindow,
        restRunMinutes: five.restRunMinutes,
        lastWorkMs,
        windowStartMs,
      }),
    });
  }

  if (driverType === "two_up") {
    const t24 = evaluateTwoUp24hRest(tapeShort);
    if (t24.applies && !t24.met) {
      out.push({
        type: "violation",
        iconKey: "Moon",
        day: "AMI",
        message: "Need ≥7h non-work in any rolling 24h period (Two-Up)",
      });
    }
    const geoEvents = collectStationaryGeoEvents(days, options);
    const scored = scoreTwoUp184E3b(geoEvents, asOf, recordStartMs);
    if (!scored.ok) {
      out.push({
        type: "violation",
        iconKey: "Moon",
        day: "AMI",
        message: TWO_UP_184E3B_FAIL_MESSAGE,
      });
      out.push(...twoUp184E3bStructureWarnings(scored.t7));
    }
  } else {
    const solo72 = evaluateSolo72h(buildEvalTape(events, asOf, AMI_72H_EVAL_LOOKBACK), {
      last24hBreak: options.last24hBreak,
      last24hBreakEndMs: options.last24hBreakEndMs ?? undefined,
    });
    if (solo72.applies && !solo72.totalNonWorkOk) {
      out.push({
        type: "warning",
        iconKey: "TrendingUp",
        day: "AMI",
        message: `Need ≥27 hrs non-work in any rolling 72hr period (24h non-work resets; this window: ${Math.round(solo72.totalNonWork / 60)}h) — 72h window ending now`,
      });
    } else if (solo72.applies && !solo72.qualBlockCountOk) {
      out.push({
        type: "warning",
        iconKey: "Moon",
        day: "AMI",
        message: `Need ≥3 blocks of ≥7 continuous hrs non-work in any rolling 72hrs (24h non-work resets; found: ${solo72.qualBlockCount}) — 72h window ending now`,
      });
    } else if (solo72.applies && !solo72.gapOk) {
      out.push({
        type: "violation",
        iconKey: "Clock",
        day: "AMI",
        message: "Two ≥7h non-work periods cannot be separated by more than 17h (elapsed time)",
      });
    }

    const priorDayCount =
      ((options.historyDays as unknown[] | null | undefined)?.length ?? 0) +
      ((options.prevWeekDays as unknown[] | null | undefined)?.length ?? 0);
    const timelineStartYmd = options.weekStarting
      ? timelineStartYmdFromPriorDays(options.weekStarting, priorDayCount)
      : undefined;
    const restOpts = evaluateSolo184E2bRestOptions(
      buildEvalTape(events, asOf, AMI_28D_WINDOW, { recordStartMs }),
      {
        timelineStartYmd,
        declaredYmdds: collectDeclared24hRests(options.declared24hRests),
      }
    );
    if (!restOpts.ok) {
      out.push({
        type: "violation",
        iconKey: "Moon",
        day: "14-day",
        message:
          "Need ≥2×24h continuous non-work in any 14-day period (or meet 28-day alternative: 4×24h + ≤144h work in any 14 days)",
      });
    }
  }

  const tape168 = buildEvalTape(events, asOf, AMI_14D_WINDOW + AMI_PATTERN_CHANGE_REST, {
    recordStartMs,
  });
  const w168 = evaluate168hWork(tape168);
  if (w168.wouldExceed168) {
    out.push({
      type: "violation",
      iconKey: "TrendingUp",
      day: "14-day",
      message: "14-day work exceeds 168h",
    });
  } else if (w168.inWarningBand) {
    const hrs = Math.round((w168.maxRollingWorkMinutes / 60) * 10) / 10;
    out.push({
      type: "warning",
      iconKey: "TrendingUp",
      day: "14-day",
      message: `${hrs}h work in a rolling 14-day window — approaching 168h limit (resets after ≥48h continuous no-work)`,
    });
  }

  return out;
}

/**
 * Entry used by getComplianceEngine(WA) when AMI flag may be on.
 * NHVR path must not call this for its outer engine (keeps calling runComplianceChecks directly).
 */
export function runWaComplianceChecks(
  days: ComplianceDayData[],
  options: RunOpts
): ComplianceCheckResult[] {
  const legacy = runComplianceChecks(days, options);
  if (!isAmiComplianceEngineEnabled()) return legacy;

  const kept = legacy.filter((r) => !isAmiOwnedResult(r));
  const ami = buildAmiOwnedResults(days, options);
  return [...kept, ...ami];
}
