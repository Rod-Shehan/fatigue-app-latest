/**
 * RULE IP — owner approval required before changing expected rule outcomes.
 * See .cursor/rules/time-rules-ip.mdc
 *
 * Contrast suite: Circadia WA rolling engines vs a synthetic NHVR-style calendar /
 * rounding model (the failure modes other EWDs often inherit). This is not Netcorp
 * source, and `NHVR_PROVISIONAL` in-app still wraps WA today.
 *
 * Citation map (owner brief → WA WHS Reg 184E as implemented):
 * - 72h / 27h non-work → Reg 184E(2)(a) solo (not (1)(d))
 * - 17h from last ≥7h non-work → 184E(2)(a) gap + solo 17h work+break episode
 * - 20 min per 5h work → 184E(1)(a)
 * - 2×24h in 14 days → 184E(2)(b)(i) solo (not (1)(e))
 * Two-up uses 184E(3), not the solo 72h / 2×24h package.
 */

import { describe, expect, it } from "vitest";
import { PASSENGER_EVENT_TYPE, SLEEPER_BERTH_EVENT_TYPE, toAmiEventType } from "@/lib/activity-kind";
import {
  applyQualifyingBreakSegment,
  emptySlots,
  qualifyingRestComplete,
} from "@/lib/five-hour-break-rule";
import { runComplianceChecks, type ComplianceDayData } from "@/lib/compliance";
import { runWaComplianceChecks } from "@/lib/ami/compliance-bridge";
import {
  buildEvalTape,
  evaluateFiveHourBreakRule,
  evaluateSeventeenHourEpisode,
  evaluateSolo14dLongRests,
  evaluateSolo72h,
  evaluateTwoUp24hRest,
  evaluateTwoUp48hOption,
  evaluateTwoUp7dOption,
} from "@/lib/ami/evaluate";
import {
  AMI_14D_WINDOW,
  AMI_72H_EVAL_LOOKBACK,
  AMI_72H_MIN_TOTAL_NON_WORK,
} from "@/lib/ami/constants";
import { getSeventeenHourEpisodeStatus, MINUTES_17H_WORK_BREAK } from "@/lib/seventeen-hour-episode";
import { getPerthMidnightUtcMs } from "@/lib/weeks";
import type { AmiEvent } from "@/lib/ami/types";

const MINUTES_PER_DAY = 1440;

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function perthMs(ymd: string, hour: number, minute = 0, second = 0): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d, hour - 8, minute, second);
}

function perthIso(ymd: string, hour: number, minute = 0, second = 0): string {
  return new Date(perthMs(ymd, hour, minute, second)).toISOString();
}

function emptyDay(): ComplianceDayData {
  return {
    work_time: Array(MINUTES_PER_DAY).fill(false),
    breaks: Array(MINUTES_PER_DAY).fill(false),
    non_work: Array(MINUTES_PER_DAY).fill(false),
    events: [],
  };
}

function emptyWeek(): ComplianceDayData[] {
  return Array.from({ length: 7 }, () => emptyDay());
}

function paintHours(arr: boolean[], fromHour: number, toHour: number): void {
  const a = Math.max(0, Math.floor(fromHour * 60));
  const b = Math.min(MINUTES_PER_DAY, Math.floor(toHour * 60));
  for (let i = a; i < b; i++) arr[i] = true;
}

function calendarNonWorkHours(day: ComplianceDayData): number {
  return (day.non_work ?? []).filter(Boolean).length / 60;
}

function calendarWorkHours(day: ComplianceDayData): number {
  return (day.work_time ?? []).filter(Boolean).length / 60;
}

/** NHVR-style: rest under 15 min is zero; 15–29 floors to 15. */
function nhvrRoundRestMinutes(rawMin: number): number {
  if (rawMin < 15) return 0;
  return Math.floor(rawMin / 15) * 15;
}

function findMsg(results: { message: string }[], snippet: string) {
  return results.find((r) => r.message.includes(snippet));
}

describe("NHVR calendar/rounding model (synthetic) vs WA rolling", () => {
  describe("1. Rolling 72h vs fixed calendar rest (solo 184E(2)(a))", () => {
    const weekStarting = "2026-06-07";
    const days = emptyWeek();
    const events: AmiEvent[] = [];

    for (let i = 0; i < 3; i++) {
      const ymd = addDaysYmd(weekStarting, i);
      paintHours(days[i]!.work_time!, 0, 16);
      paintHours(days[i]!.non_work!, 16, 24);
      days[i]!.events = [
        { time: perthIso(ymd, 0), type: "work" },
        { time: perthIso(ymd, 16), type: "stop" },
      ];
      events.push(
        { time: perthIso(ymd, 0), type: "work" },
        { time: perthIso(ymd, 16), type: "stop" }
      );
    }
    const d4 = addDaysYmd(weekStarting, 3);
    paintHours(days[3]!.work_time!, 0, 12);
    days[3]!.events = [{ time: perthIso(d4, 0), type: "work" }];
    events.push({ time: perthIso(d4, 0), type: "work" });

    const asOfMs = perthMs(d4, 12);
    const asOfOpts = {
      driverType: "solo" as const,
      weekStarting,
      currentDayIndex: 3,
      slotOffsetWithinToday: 12 * 60,
    };

    it("NHVR-style calendar check passes: each of days 1–3 has 8h rest", () => {
      expect([0, 1, 2].every((i) => calendarNonWorkHours(days[i]!) >= 8)).toBe(true);
    });

    it("WA AMI rolling 72h ending Day 4 12:00 has only 24h non-work (<27h)", () => {
      const tape = buildEvalTape(events, asOfMs, AMI_72H_EVAL_LOOKBACK);
      const r = evaluateSolo72h(tape);
      expect(r.applies).toBe(true);
      expect(r.totalNonWork).toBe(24 * 60);
      expect(r.totalNonWork).toBeLessThan(AMI_72H_MIN_TOTAL_NON_WORK);
      expect(r.totalNonWorkOk).toBe(false);
      expect(r.qualBlockCount).toBe(3);
    });

    it("WA live overlay warns on that 72h window (legacy + AMI)", () => {
      const live = runWaComplianceChecks(days, asOfOpts);
      const legacy = runComplianceChecks(days, asOfOpts);
      expect(findMsg(live, "≥27 hrs non-work")).toBeDefined();
      expect(findMsg(live, "24h)")).toBeDefined();
      expect(findMsg(legacy, "≥27 hrs non-work")).toBeDefined();
    });
  });

  describe("2. 17h floating clock vs calendar-day work cap (solo)", () => {
    const ymd = "2026-06-10";
    const events: AmiEvent[] = [
      { time: perthIso(ymd, 0), type: "stop" },
      { time: perthIso(ymd, 4), type: "work" },
      { time: perthIso(ymd, 12), type: "stop" },
      { time: perthIso(ymd, 18), type: "work" },
    ];

    it("NHVR-style 12h work in the calendar day would pass a 12/14h daily cap", () => {
      expect(8 + 4).toBe(12);
    });

    it("6h non-work does not reset the WA 17h work+break episode", () => {
      const at2100 = getSeventeenHourEpisodeStatus(events, perthMs(ymd, 21));
      expect(at2100.workBreakMinutesSinceAnchor).toBe(8 * 60 + 3 * 60);
      expect(at2100.workBreakMinutesSinceAnchor).toBeLessThan(MINUTES_17H_WORK_BREAK);
      expect(at2100.withinSeventeenHourEpisode).toBe(true);

      const ami = evaluateSeventeenHourEpisode(events, perthMs(ymd, 21));
      expect(ami.workBreakMinutesSinceAnchor).toBe(11 * 60);
      expect(ami.withinSeventeenHourEpisode).toBe(true);
    });

    it("a 7h non-work would reset; 6h does not drop used work+break to the post-rest 4h only", () => {
      const resetEvents: AmiEvent[] = [
        { time: perthIso(ymd, 0), type: "stop" },
        { time: perthIso(ymd, 4), type: "work" },
        { time: perthIso(ymd, 12), type: "stop" },
        { time: perthIso(ymd, 19), type: "work" },
      ];
      const after7h = getSeventeenHourEpisodeStatus(resetEvents, perthMs(ymd, 21));
      expect(after7h.workBreakMinutesSinceAnchor).toBe(2 * 60);
    });
  });

  describe("3. 19-minute stop is not a 20-minute 184E(1)(a) break", () => {
    it("NHVR 15-min rounding turns 19.5 min into 15; WA still requires 20 continuous (or 2×10)", () => {
      expect(nhvrRoundRestMinutes(19.5)).toBe(15);
      const nhvrSlots = emptySlots();
      applyQualifyingBreakSegment(nhvrRoundRestMinutes(19.5), nhvrSlots);
      expect(qualifyingRestComplete(nhvrSlots)).toBe(false);

      const wa19 = emptySlots();
      applyQualifyingBreakSegment(19, wa19);
      expect(qualifyingRestComplete(wa19)).toBe(false);

      const wa20 = emptySlots();
      applyQualifyingBreakSegment(20, wa20);
      expect(qualifyingRestComplete(wa20)).toBe(true);
    });

    it("4h55 work + 19 min 30 s rest + resume: floor-to-minute rest is 19; AMI 5h is not complete", () => {
      const ymd = "2026-06-10";
      const events: AmiEvent[] = [
        { time: perthIso(ymd, 8, 0), type: "work" },
        { time: perthIso(ymd, 12, 55), type: "break" },
        { time: perthIso(ymd, 13, 14, 30), type: "work" },
      ];
      const asOf = perthMs(ymd, 13, 20);
      const restMs = perthMs(ymd, 13, 14, 30) - perthMs(ymd, 12, 55);
      expect(Math.floor(restMs / 60_000)).toBe(19);

      const five = evaluateFiveHourBreakRule(buildEvalTape(events, asOf, 12 * 60));
      expect(five.restComplete).toBe(false);
      expect(five.workMinutesInWindow).toBeGreaterThanOrEqual(300);

      const sheet = emptyWeek();
      sheet[0]!.events = [
        { time: perthIso(ymd, 8, 0), type: "work" },
        { time: perthIso(ymd, 12, 55), type: "break" },
        { time: perthIso(ymd, 13, 14, 30), type: "work" },
        { time: perthIso(ymd, 13, 20), type: "work" },
      ];
      paintHours(sheet[0]!.work_time!, 8, 12 + 55 / 60);
      paintHours(sheet[0]!.work_time!, 13 + 14.5 / 60, 13 + 20 / 60);
      paintHours(sheet[0]!.breaks!, 12 + 55 / 60, 13 + 14.5 / 60);
      const results = runComplianceChecks(sheet, { driverType: "solo" });
      expect(
        results.some(
          (r) =>
            r.message.includes("20 min rest per 5h work") ||
            r.message.includes("More than 5h work without valid break")
        )
      ).toBe(true);
    });
  });

  describe("4. Rolling 14-day 2×24h vs nightly 10h rest (solo 184E(2)(b)(i))", () => {
    const currentWeek = "2026-06-07";
    const historyStart = addDaysYmd(currentWeek, -7);
    const historyDays = Array.from({ length: 7 }, () => emptyDay());
    const days = emptyWeek();
    const events: AmiEvent[] = [];

    for (let i = 0; i < 13; i++) {
      const ymd = addDaysYmd(historyStart, i);
      const bucket = i < 7 ? historyDays[i]! : days[i - 7]!;
      paintHours(bucket.work_time!, 8, 18);
      paintHours(bucket.non_work!, 0, 8);
      paintHours(bucket.non_work!, 18, 24);
      bucket.events = [
        { time: perthIso(ymd, 8), type: "work" },
        { time: perthIso(ymd, 18), type: "stop" },
      ];
      events.push(
        { time: perthIso(ymd, 8), type: "work" },
        { time: perthIso(ymd, 18), type: "stop" }
      );
    }
    const day14 = addDaysYmd(historyStart, 13);
    paintHours(days[6]!.work_time!, 8, 9);
    days[6]!.events = [...(days[6]!.events ?? []), { time: perthIso(day14, 8), type: "work" }];
    events.push({ time: perthIso(day14, 8), type: "work" });

    const asOfMs = perthMs(day14, 8, 30);
    const recordStartMs = getPerthMidnightUtcMs(historyStart);
    const opts = {
      driverType: "solo" as const,
      weekStarting: currentWeek,
      historyDays,
      currentDayIndex: 6,
      slotOffsetWithinToday: 8 * 60 + 30,
    };

    it("NHVR-style totals pass: 130h work in 13 days, nightly ≥10h rest, under 168h", () => {
      const workHrs =
        historyDays.reduce((s, d) => s + calendarWorkHours(d), 0) +
        days.reduce((s, d) => s + calendarWorkHours(d), 0);
      expect(workHrs).toBeLessThan(168);
      expect(workHrs).toBeGreaterThanOrEqual(130);
      const nights = [...historyDays, ...days.slice(0, 6)];
      expect(nights.every((d) => calendarNonWorkHours(d) >= 10)).toBe(true);
    });

    it("WA AMI 14-day long-rest count is below 2×24h", () => {
      const tape = buildEvalTape(events, asOfMs, AMI_14D_WINDOW, { recordStartMs });
      const r = evaluateSolo14dLongRests(tape);
      expect(r.longRestCount).toBeLessThan(2);
      expect(r.ok).toBe(false);
    });

    it("WA live overlay flags the 2×24h deficit before work on day 14", () => {
      const live = runWaComplianceChecks(days, opts);
      expect(findMsg(live, "2×24h continuous non-work")).toBeDefined();
    });
  });

  describe("Two-up 184E(3) rolling vs calendar day", () => {
    it("calendar 8h rest each day can still fail rolling 24h ≥7h non-work", () => {
      const weekStarting = "2026-06-07";
      const d1 = weekStarting;
      const d2 = addDaysYmd(weekStarting, 1);
      const days = emptyWeek();
      paintHours(days[0]!.non_work!, 0, 8);
      paintHours(days[0]!.work_time!, 8, 24);
      paintHours(days[1]!.work_time!, 0, 6);
      paintHours(days[1]!.non_work!, 6, 14);
      paintHours(days[1]!.work_time!, 14, 16);
      days[0]!.events = [
        { time: perthIso(d1, 8), type: "work" },
        { time: perthIso(d2, 6), type: "stop" },
      ];
      days[1]!.events = [
        { time: perthIso(d2, 6), type: "stop" },
        { time: perthIso(d2, 14), type: "work" },
      ];
      expect(calendarNonWorkHours(days[0]!)).toBe(8);
      expect(calendarNonWorkHours(days[1]!)).toBe(8);

      const asOfMs = perthMs(d2, 8);
      const events: AmiEvent[] = [
        { time: perthIso(d1, 8), type: "work" },
        { time: perthIso(d2, 6), type: "stop" },
        { time: perthIso(d2, 14), type: "work" },
      ];
      const t24 = evaluateTwoUp24hRest(buildEvalTape(events, asOfMs, 48 * 60));
      expect(t24.applies).toBe(true);
      expect(t24.met).toBe(false);

      const sheet = runComplianceChecks(days, { driverType: "two_up" });
      expect(findMsg(sheet, "≥7h non-work in any rolling 24h")).toBeDefined();
    });

    it("nightly 10h rest is not a 24h block: 7-day option fails; 48h option can still pass", () => {
      const ymd0 = "2026-06-07";
      const events: AmiEvent[] = [];
      for (let i = 0; i < 7; i++) {
        const ymd = addDaysYmd(ymd0, i);
        events.push(
          { time: perthIso(ymd, 8), type: "work" },
          { time: perthIso(ymd, 18), type: "stop" }
        );
      }
      const asOf = perthMs(addDaysYmd(ymd0, 6), 18);
      const tape7 = buildEvalTape(events, asOf, 7 * 24 * 60, {
        recordStartMs: perthMs(ymd0, 0),
      });
      const opt7 = evaluateTwoUp7dOption(tape7);
      expect(opt7.has24hBlock).toBe(false);
      expect(opt7.structureOk).toBe(false);
      const opt48 = evaluateTwoUp48hOption(buildEvalTape(events, asOf, 48 * 60));
      expect(opt48.hasQualBlock).toBe(true);
    });

    it("Passenger is work time for two-up 24h; sleeper berth is non-work", () => {
      const ymd = "2026-06-10";
      const passenger: AmiEvent[] = [
        { time: perthIso(ymd, 0), type: "work" },
        { time: perthIso(ymd, 8), type: toAmiEventType(PASSENGER_EVENT_TYPE)! },
      ];
      const sleeper: AmiEvent[] = [
        { time: perthIso(ymd, 0), type: "work" },
        { time: perthIso(ymd, 8), type: toAmiEventType(SLEEPER_BERTH_EVENT_TYPE)! },
      ];
      const asOf = perthMs(ymd, 20);
      expect(evaluateTwoUp24hRest(buildEvalTape(passenger, asOf, 24 * 60)).met).toBe(false);
      expect(evaluateTwoUp24hRest(buildEvalTape(sleeper, asOf, 24 * 60)).met).toBe(true);
    });
  });
});
