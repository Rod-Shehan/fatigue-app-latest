/**
 * Time-on-task fatigue carry (sawtooth) for manager risk timeline.
 *
 * Not biomathematical FRMS (NHVR FRMSc). Deterministic v1 aligned with:
 * - Two-process theory: homeostatic pressure rises with wake/work, drops with sleep/rest
 *   (Borbély, 1982, Human Neurobiology).
 * - Time-on-task and crash risk increase over continuous driving/work periods
 *   (Williamson & Lombardi, 2015, Am J Ind Med — systematic review).
 * - Rest breaks counteract driver fatigue in field studies
 *   (Dawson et al., 2001, factors counteracting fatigue — cited in Aust road safety literature).
 * - WA Reg 184E(1)(a): ≥20 min breaks per 5 h work incl. ≥10 min after 5 h
 *   (Work Health and Safety (General) Regulations 2022).
 *
 * App mapping: logged breaks >30 min → non-work; shorter logged breaks → break-from-driving (recovery partial).
 * End shift and other non-break off-duty time stay non-work (no invent-break from short gaps).
 */

/** Continuous work without qualifying recovery before carry saturates (~5 h). */
export const FATIGUE_TIME_ON_TASK_SATURATION_MIN = 300;

/** Short break from driving (app: ≤30 min break grid). */
export const FATIGUE_PARTIAL_BREAK_RECOVERY_MIN = 15;

/** Longer non-work / end-of-break rest (app: >30 min → non-work). */
export const FATIGUE_FULL_REST_RECOVERY_MIN = 30;

/** Multiplier on carry after a qualifying 15–29 min break (~60% relief). */
export const FATIGUE_POST_PARTIAL_BREAK_MULTIPLIER = 0.4;

/** Multiplier after ≥30 min rest / non-work block (~88% relief). */
export const FATIGUE_POST_FULL_REST_MULTIPLIER = 0.12;

/** Work minutes needed to add ~1.0 carry when starting from 0. */
export const FATIGUE_CARRY_WORK_MINUTES_TO_MAX = FATIGUE_TIME_ON_TASK_SATURATION_MIN;

export type FatigueCarryState = { carry: number };

export type FatigueCarryBlockEvent = {
  workMinutes: number;
  recoveryMinutes: number;
  nonWork: boolean;
};

export const FATIGUE_RISK_REFERENCES = [
  {
    id: "borbely-1982",
    citation: "Borbély AA (1982). A two process model of sleep regulation. Human Neurobiology.",
    use: "Homeostatic (Process S) rise with wake/work; fall with sleep/rest.",
  },
  {
    id: "williamson-lombardi-2015",
    citation: "Williamson A, Lombardi DA (2015). Driving hours and crash risk: systematic review. Am J Ind Med.",
    use: "Crash risk increases with hours on task / continuous work.",
  },
  {
    id: "dawson-2001",
    citation: "Dawson D et al. (2001). Fatigue and road crashes: factors counteracting driver fatigue.",
    use: "Rest breaks reduce fatigue-related risk between work bouts.",
  },
  {
    id: "wa-184e",
    citation: "WA WHS (General) Reg 2022 reg 184E(1)(a) — breaks per 5 h work.",
    use: "Regulatory minimum break structure (product alignment, not biomath cert).",
  },
] as const;

/** Advance 0–1 carry across one 15-minute block (stateful sawtooth). */
export function advanceFatigueCarryState(
  state: FatigueCarryState,
  block: FatigueCarryBlockEvent
): FatigueCarryState {
  let carry = state.carry;

  if (block.nonWork || block.recoveryMinutes >= FATIGUE_FULL_REST_RECOVERY_MIN) {
    carry *= FATIGUE_POST_FULL_REST_MULTIPLIER;
  } else if (block.recoveryMinutes >= FATIGUE_PARTIAL_BREAK_RECOVERY_MIN) {
    carry *= FATIGUE_POST_PARTIAL_BREAK_MULTIPLIER;
  } else if (block.workMinutes > 0) {
    carry = Math.min(
      1,
      carry + block.workMinutes / FATIGUE_CARRY_WORK_MINUTES_TO_MAX
    );
  }

  return { carry: Math.max(0, Math.min(1, carry)) };
}

/**
 * Proxy carry from diary fields when full block history is unavailable.
 * minutes_since_break low ⇒ recent recovery ⇒ lower carry.
 */
export function inferCarryFromDiaryProxies(
  minutesSinceBreak: number,
  workMinutes: number,
  recoveryMinutesInBlock = 0,
  nonWorkBlock = false
): number {
  let carry = Math.min(
    1,
    Math.max(0, minutesSinceBreak) / FATIGUE_TIME_ON_TASK_SATURATION_MIN
  );

  if (nonWorkBlock || recoveryMinutesInBlock >= FATIGUE_FULL_REST_RECOVERY_MIN) {
    carry *= FATIGUE_POST_FULL_REST_MULTIPLIER;
  } else if (recoveryMinutesInBlock >= FATIGUE_PARTIAL_BREAK_RECOVERY_MIN) {
    carry *= FATIGUE_POST_PARTIAL_BREAK_MULTIPLIER;
  } else if (workMinutes === 0 && minutesSinceBreak < FATIGUE_PARTIAL_BREAK_RECOVERY_MIN) {
    carry *= FATIGUE_POST_PARTIAL_BREAK_MULTIPLIER;
  }

  return Math.max(0, Math.min(1, carry));
}

/** Demo shift: ~2 h work then 15 min break (WA 5 h / 20 min pattern scaled for visible sawtooth). */
export const DEMO_WORK_BLOCKS_PER_BREAK = 8;
export const DEMO_BREAK_BLOCKS = 1;

export function demoBlockEventForIndex(blockIndex: number, isPastOrNow: boolean): FatigueCarryBlockEvent {
  if (!isPastOrNow) {
    return { workMinutes: 0, recoveryMinutes: 0, nonWork: true };
  }

  const cycle = DEMO_WORK_BLOCKS_PER_BREAK + DEMO_BREAK_BLOCKS;
  const pos = blockIndex % cycle;

  if (pos < DEMO_WORK_BLOCKS_PER_BREAK) {
    return { workMinutes: 14, recoveryMinutes: 0, nonWork: false };
  }

  return { workMinutes: 0, recoveryMinutes: 15, nonWork: false };
}

/** Walk demo blocks to produce carry + minutesSinceBreak for each slot. */
export function buildDemoFatigueWalk(
  blockCount: number,
  isPastOrNow: (index: number) => boolean
): { carry: number; minutesSinceBreak: number; workMinutes: number; recoveryMinutes: number; nonWork: boolean }[] {
  const out: {
    carry: number;
    minutesSinceBreak: number;
    workMinutes: number;
    recoveryMinutes: number;
    nonWork: boolean;
  }[] = [];
  let state: FatigueCarryState = { carry: 0.08 };
  let minutesSinceBreak = 0;

  for (let i = 0; i < blockCount; i++) {
    const event = demoBlockEventForIndex(i, isPastOrNow(i));
    state = advanceFatigueCarryState(state, event);

    if (event.recoveryMinutes > 0 || event.nonWork) {
      minutesSinceBreak = event.recoveryMinutes;
    } else if (event.workMinutes > 0) {
      minutesSinceBreak += 15;
    }

    out.push({
      carry: state.carry,
      minutesSinceBreak,
      workMinutes: event.workMinutes,
      recoveryMinutes: event.recoveryMinutes,
      nonWork: event.nonWork,
    });
  }

  return out;
}
