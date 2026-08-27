/**
 * RULE IP — owner approval required before changing expected rule outcomes.
 * See .cursor/rules/time-rules-ip.mdc
 *
 * Port of the owner “EWD Core” pytest suite onto Circadia WA engines.
 * This is not a second calculator: unlogged time is non-work; two-up is 184E(3);
 * 144h is the 28-day alternative, not a default roster cap; long rest is ≥31 min
 * (not 30) before a logged break becomes non-work.
 *
 * Python interval engine vs Circadia:
 * - Gaps with no log: Python ignores them; Circadia fills non-work.
 * - Two-up moving berth: Python still demands solo 72h 3×7h stationary; Circadia uses 7h in 24h.
 * - 28-day “144h roster”: Python always caps any 14-day window at 144h; Circadia uses 168h
 *   unless option (ii) (4×24h + ≤144h in any 14 days inside 28 days) is the path.
 */

import { describe, expect, it } from "vitest";
import { PASSENGER_EVENT_TYPE, SLEEPER_BERTH_EVENT_TYPE, STATIONARY_REST_EVENT_TYPE } from "@/lib/activity-kind";
import {
  AMI_14D_WINDOW,
  AMI_28D_WINDOW,
  AMI_28D_MAX_14D_WORK,
  AMI_168H_MAX_WORK,
  AMI_72H_EVAL_LOOKBACK,
  AMI_72H_MIN_TOTAL_NON_WORK,
  AMI_72H_QUAL_BLOCK_COUNT,
} from "@/lib/ami/constants";
import {
  buildEvalTape,
  evaluate168hWork,
  evaluateSolo14dLongRests,
  evaluateSolo184E2bRestOptions,
  evaluateSolo72h,
  evaluateTwoUp24hRest,
  evaluateTwoUp48hOption,
} from "@/lib/ami/evaluate";
import type { AmiEvent } from "@/lib/ami/types";
import { evaluateTwoUp48hStationaryOption, evaluateTwoUp7dStationaryOption } from "@/lib/two-up-stationary";

const H = 3600_000;
const MIN = 60_000;
const BASE = Date.UTC(2026, 7, 1, 0, 0, 0);

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function hours(n: number): number {
  return n * H;
}

function minutes(n: number): number {
  return n * MIN;
}

function asAmi(events: { time: string; type: string }[]): AmiEvent[] {
  return events as AmiEvent[];
}

function tapeAt(events: { time: string; type: string }[], asOfMs: number, lookbackMin: number) {
  return buildEvalTape(asAmi(events), asOfMs, lookbackMin, { recordStartMs: BASE });
}

function countKind(kinds: string[], kind: string, from: number): number {
  let n = 0;
  for (let i = from; i < kinds.length; i++) if (kinds[i] === kind) n++;
  return n;
}

describe("WA EWD core suite (Circadia engines)", () => {
  describe("1. Solo 72h — Reg 184E(2)(a)", () => {
    it("15h work + 9h stationary ×3 is 27h non-work and 3×7h blocks", () => {
      const events: { time: string; type: string }[] = [];
      let t = BASE;
      for (let i = 0; i < 3; i++) {
        events.push({ time: iso(t), type: "work" });
        t += hours(15);
        events.push({ time: iso(t), type: "stop" });
        t += hours(9);
      }
      const asOf = BASE + hours(72);
      const r = evaluateSolo72h(tapeAt(events, asOf, AMI_72H_EVAL_LOOKBACK));
      expect(r.applies).toBe(true);
      expect(r.totalNonWork).toBe(AMI_72H_MIN_TOTAL_NON_WORK);
      expect(r.qualBlockCount).toBe(AMI_72H_QUAL_BLOCK_COUNT);
      expect(r.totalNonWorkOk).toBe(true);
      expect(r.qualBlockCountOk).toBe(true);
      expect(r.gapOk).toBe(true);
    });

    it("16h work + 8h rest ×3 in 72h is only 24h non-work (NHVR-style sliding deficit)", () => {
      const events: { time: string; type: string }[] = [];
      let t = BASE;
      for (let i = 0; i < 3; i++) {
        events.push({ time: iso(t), type: "work" });
        t += hours(16);
        events.push({ time: iso(t), type: "stop" });
        t += hours(8);
      }
      const asOf = BASE + hours(72);
      const r = evaluateSolo72h(tapeAt(events, asOf, AMI_72H_EVAL_LOOKBACK));
      expect(r.applies).toBe(true);
      expect(r.totalNonWork).toBe(24 * 60);
      expect(r.totalNonWorkOk).toBe(false);
      expect(r.qualBlockCount).toBeGreaterThanOrEqual(3);
    });

    it("29 min logged rest does not count as 72h non-work (Circadia ≥31 min; remaining 72h packed as work)", () => {
      const events: { time: string; type: string }[] = [
        { time: iso(BASE), type: "stop" },
        { time: iso(BASE + hours(9)), type: "work" },
        { time: iso(BASE + hours(24)), type: "stop" },
        { time: iso(BASE + hours(33)), type: "work" },
        { time: iso(BASE + hours(48)), type: "stop" },
        { time: iso(BASE + hours(56)), type: "break" },
        { time: iso(BASE + hours(56) + minutes(29)), type: "work" },
      ];
      const asOf = BASE + hours(72);
      const tape = tapeAt(events, asOf, AMI_72H_EVAL_LOOKBACK);
      const r = evaluateSolo72h(tape);
      expect(r.applies).toBe(true);
      expect(r.totalNonWork).toBe(26 * 60);
      expect(r.totalNonWorkOk).toBe(false);
      const from = r.windowFromMinute;
      expect(countKind(tape.kinds, "break", from)).toBe(29);
    });
  });

  describe("2. 14-day 168h vs 28-day alternative 144h", () => {
    it("12 × 13h20 work + 48h rest: under 168h and 2×24h logged", () => {
      const events: { time: string; type: string }[] = [];
      let t = BASE;
      for (let i = 0; i < 12; i++) {
        events.push({ time: iso(t), type: "work" });
        t += hours(13) + minutes(20);
        events.push({ time: iso(t), type: "stop" });
        t += hours(10) + minutes(40);
      }
      events.push({ time: iso(t), type: "stop" });
      const asOf = BASE + hours(14 * 24);
      const tape = tapeAt(events, asOf, AMI_14D_WINDOW);
      const h168 = evaluate168hWork(tape);
      expect(h168.maxRollingWorkMinutes).toBe(160 * 60);
      expect(h168.wouldExceed168).toBe(false);
      expect(h168.maxRollingWorkMinutes).toBeLessThanOrEqual(AMI_168H_MAX_WORK);
      const rests = evaluateSolo14dLongRests(tape);
      expect(rests.longRestCount).toBeGreaterThanOrEqual(2);
      expect(rests.ok).toBe(true);
    });

    it("14 × ~11h work is under 168h; 144h is not the default cap (only 28-day option ii)", () => {
      const events: { time: string; type: string }[] = [];
      let t = BASE;
      for (let i = 0; i < 14; i++) {
        events.push({ time: iso(t), type: "work" });
        t += hours(11) + minutes(4);
        events.push({ time: iso(t), type: "stop" });
        t += hours(12) + minutes(56);
      }
      const asOf = BASE + hours(14 * 24);
      const tape = tapeAt(events, asOf, AMI_14D_WINDOW);
      const h168 = evaluate168hWork(tape);
      expect(h168.maxRollingWorkMinutes).toBe(14 * (11 * 60 + 4));
      expect(h168.wouldExceed168).toBe(false);
      expect(h168.maxRollingWorkMinutes).toBeGreaterThan(AMI_28D_MAX_14D_WORK);
      const rests = evaluateSolo14dLongRests(tape);
      expect(rests.ok).toBe(false);
      const opt = evaluateSolo184E2bRestOptions(tapeAt(events, asOf, AMI_28D_WINDOW), {
        timelineStartYmd: "2026-08-01",
      });
      expect(opt.option14Ok).toBe(false);
      expect(opt.ok).toBe(false);
    });

    it("4×24h in 28 days with ≤144h work passes option (ii) when last 14 days have only 1×24h", () => {
      const events: { time: string; type: string }[] = [];
      const restDays = new Set([0, 6, 12, 27]);
      for (let d = 0; d < 28; d++) {
        if (restDays.has(d)) continue;
        const t = BASE + hours(d * 24);
        events.push({ time: iso(t), type: "work" });
        events.push({ time: iso(t + hours(10)), type: "stop" });
      }
      const asOf = BASE + hours(28 * 24);
      const tape = tapeAt(events, asOf, AMI_28D_WINDOW);
      const opt = evaluateSolo184E2bRestOptions(tape, { timelineStartYmd: "2026-08-01" });
      expect(opt.option14Ok).toBe(false);
      expect(opt.option28Ok).toBe(true);
      expect(opt.ok).toBe(true);
    });

    it("4×24h does not pass option (ii) when a 14-day window exceeds 144h work", () => {
      const events: { time: string; type: string }[] = [];
      const restDays = new Set([0, 6, 12, 27]);
      for (let d = 0; d < 28; d++) {
        if (restDays.has(d)) continue;
        const t = BASE + hours(d * 24);
        events.push({ time: iso(t), type: "work" });
        events.push({ time: iso(t + hours(12)), type: "stop" });
      }
      const asOf = BASE + hours(28 * 24);
      const tape = tapeAt(events, asOf, AMI_28D_WINDOW);
      const opt = evaluateSolo184E2bRestOptions(tape, { timelineStartYmd: "2026-08-01" });
      expect(opt.option14Ok).toBe(false);
      expect(opt.option28Ok).toBe(false);
      expect(opt.ok).toBe(false);
    });
  });

  describe("3. Two-up — Reg 184E(3), not solo 72h", () => {
    it("moving sleeper berth counts as non-work and can meet 7h in 24h", () => {
      const eventsA: { time: string; type: string }[] = [];
      let t = BASE;
      for (let i = 0; i < 12; i++) {
        if (i % 2 === 0) {
          eventsA.push({ time: iso(t), type: "work" });
        } else {
          eventsA.push({ time: iso(t), type: SLEEPER_BERTH_EVENT_TYPE });
        }
        t += hours(6);
      }
      const asOf = BASE + hours(72);
      const tape = tapeAt(eventsA, asOf, AMI_72H_EVAL_LOOKBACK);
      const t24 = evaluateTwoUp24hRest(buildEvalTape(asAmi(eventsA), asOf, 24 * 60, { recordStartMs: BASE }));
      expect(t24.met).toBe(true);
      expect(t24.nonWorkMinutes).toBeGreaterThanOrEqual(7 * 60);

      const solo72 = evaluateSolo72h(tape);
      expect(solo72.applies).toBe(true);
      expect(solo72.totalNonWork).toBe(36 * 60);
      expect(solo72.qualBlockCount).toBe(0);
      expect(solo72.qualBlockCountOk).toBe(false);
    });

    it("passenger seat is work, not non-work", () => {
      const events = [
        { time: iso(BASE), type: PASSENGER_EVENT_TYPE },
        { time: iso(BASE + hours(5)), type: "stop" },
      ];
      const asOf = BASE + hours(5);
      const tape = buildEvalTape(asAmi(events), asOf, 5 * 60, { recordStartMs: BASE });
      expect(countKind(tape.kinds, "other_work", 0)).toBe(5 * 60);
      expect(countKind(tape.kinds, "non_work", 0)).toBe(0);
      expect(countKind(tape.kinds, "work", 0)).toBe(0);
    });

    it("7h GPS End shift meets 48h option when 7-day structure fails (live scoring)", () => {
      const gps = { lat: -31.95, lng: 115.86 };
      const events = [
        { time: iso(BASE), type: "work" },
        { time: iso(BASE + hours(10)), type: "stop", ...gps },
      ];
      const asOf = BASE + hours(17);
      const t7 = evaluateTwoUp7dStationaryOption(events, asOf, BASE);
      const t48 = evaluateTwoUp48hStationaryOption(events, asOf, BASE);
      expect(t7.structureOk).toBe(false);
      expect(t48.hasQualBlock).toBe(true);
    });

    it("End shift without GPS does not meet 48h option on the live path (tape still credits any non-work)", () => {
      const events = [
        { time: iso(BASE), type: "work" },
        { time: iso(BASE + hours(10)), type: "stop" },
      ];
      const asOf = BASE + hours(17);
      expect(evaluateTwoUp48hStationaryOption(events, asOf, BASE).hasQualBlock).toBe(false);
      const t48Tape = evaluateTwoUp48hOption(
        buildEvalTape(asAmi(events), asOf, 48 * 60, { recordStartMs: BASE })
      );
      expect(t48Tape.hasQualBlock).toBe(true);
    });

    it("7h GPS Parked meets 48h option; 7h sleeper berth does not (live stationary path)", () => {
      const gps = { lat: -31.95, lng: 115.86 };
      const parked = [
        { time: iso(BASE), type: "work" },
        { time: iso(BASE + hours(10)), type: STATIONARY_REST_EVENT_TYPE, ...gps },
      ];
      const sleeper = [
        { time: iso(BASE), type: "work" },
        { time: iso(BASE + hours(10)), type: SLEEPER_BERTH_EVENT_TYPE, ...gps },
      ];
      const asOf = BASE + hours(17);
      expect(evaluateTwoUp48hStationaryOption(parked, asOf, BASE).hasQualBlock).toBe(true);
      expect(evaluateTwoUp48hStationaryOption(sleeper, asOf, BASE).hasQualBlock).toBe(false);
    });
  });
});
