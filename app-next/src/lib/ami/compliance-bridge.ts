/**
 * Phase 3 — WA compliance bridge: optional AMI overlay behind flag.
 * Default: 100% legacy runComplianceChecks.
 * Flag on: keep legacy results that AMI does not own; replace AMI-owned families with AMI evaluations.
 */

import type { ComplianceCheckResult, ComplianceDayData } from "@/lib/compliance";
import { runComplianceChecks } from "@/lib/compliance";
import { getEventsInTimeOrder } from "@/lib/rolling-events";
import { getSheetDayDateString } from "@/lib/weeks";
import {
  AMI_14D_WINDOW,
  AMI_72H_WINDOW,
  AMI_PATTERN_CHANGE_REST,
} from "./constants";
import {
  buildEvalTape,
  evaluate168hWork,
  evaluateFiveHourBreakRule,
  evaluateSolo14dLongRests,
  evaluateSolo72h,
  evaluateTwoUp24hRest,
  evaluateTwoUp48hOption,
  evaluateTwoUp7dOption,
} from "./evaluate";
import { isAmiComplianceEngineEnabled } from "./flag";
import type { AmiEvent } from "./types";

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
      type: e.type as AmiEvent["type"],
    }))
    .filter((e) => ["work", "break", "non_work", "stop"].includes(e.type));
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
    const [y, m, d] = ymd.split("-").map(Number);
    const start = new Date(y!, m! - 1, d!).getTime();
    return start + Math.min(1440, Math.max(0, slotOffsetWithinToday)) * 60_000;
  }
  return Date.now();
}

function buildAmiOwnedResults(
  days: ComplianceDayData[],
  options: RunOpts
): ComplianceCheckResult[] {
  const events = collectAmiEvents(days, options);
  const asOf = resolveAsOfMs(options);
  const driverType = options.driverType ?? "solo";
  const out: ComplianceCheckResult[] = [];

  const tapeShort = buildEvalTape(events, asOf, Math.max(AMI_72H_WINDOW, 24 * 60));
  const five = evaluateFiveHourBreakRule(tapeShort);
  if (!five.restComplete && five.workMinutesInWindow >= 300) {
    out.push({
      type: "violation",
      iconKey: "AlertTriangle",
      day: "AMI",
      message: "More than 5h work without valid break",
      ruleId: undefined,
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
    const t7 = evaluateTwoUp7dOption(buildEvalTape(events, asOf, 7 * 24 * 60));
    if (!t7.structureOk && t7.totalNonWork > 0 && t7.totalNonWork < 2880) {
      out.push({
        type: "warning",
        iconKey: "TrendingUp",
        day: "7-day",
        message: `Need ≥48 hrs non-work in any 7-day period (current: ${Math.round(t7.totalNonWork / 60)}h) — Two-Up`,
      });
    }
    const t48 = evaluateTwoUp48hOption(buildEvalTape(events, asOf, 48 * 60));
    if (!t7.structureOk && !t48.hasQualBlock) {
      out.push({
        type: "violation",
        iconKey: "Moon",
        day: "AMI",
        message: "Need ≥7h continuous non-work in any rolling 48h (Two-Up 48h option)",
      });
    }
  } else {
    const solo72 = evaluateSolo72h(buildEvalTape(events, asOf, AMI_72H_WINDOW));
    if (!solo72.totalNonWorkOk) {
      out.push({
        type: "warning",
        iconKey: "TrendingUp",
        day: "AMI",
        message: `Need ≥27 hrs non-work in any rolling 72hr period (24h non-work resets; this window: ${Math.round(solo72.totalNonWork / 60)}h) — 72h window ending now`,
      });
    } else if (!solo72.qualBlockCountOk) {
      out.push({
        type: "warning",
        iconKey: "Moon",
        day: "AMI",
        message: `Need ≥3 blocks of ≥7 continuous hrs non-work in any rolling 72hrs (24h non-work resets; found: ${solo72.qualBlockCount}) — 72h window ending now`,
      });
    } else if (!solo72.gapOk) {
      out.push({
        type: "violation",
        iconKey: "Clock",
        day: "AMI",
        message: "Two ≥7h non-work periods cannot be separated by more than 17h (elapsed time)",
      });
    }

    const rests = evaluateSolo14dLongRests(
      buildEvalTape(events, asOf, AMI_14D_WINDOW, { clipToFirstEvent: true })
    );
    if (!rests.ok) {
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
    clipToFirstEvent: true,
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
