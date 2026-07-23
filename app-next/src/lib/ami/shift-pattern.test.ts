import { describe, expect, it } from "vitest";
import {
  AMI_PATTERN_CHANGE_REST,
  measurePatternChangeRestContinuousNonWork,
  measurePatternChangeRestOnlyWorkInterrupts,
  patternChangeRestMet,
  type AmiTape,
} from "./index";

function tape(kinds: AmiTape["kinds"]): AmiTape {
  return { originMs: 0, endMs: kinds.length * 60_000, kinds };
}

describe("AMI 184E(4) pattern-change rest variants", () => {
  it("only-work-interrupts: short break inside non_work still counts toward 1440", () => {
    // 700 nw + 20 break + 720 nw = 1440 rest minutes, no work
    const kinds: AmiTape["kinds"] = [
      ...Array(700).fill("non_work"),
      ...Array(20).fill("break"),
      ...Array(720).fill("non_work"),
    ];
    const t = tape(kinds);
    const onlyWork = measurePatternChangeRestOnlyWorkInterrupts(t, 0, kinds.length);
    const pureNw = measurePatternChangeRestContinuousNonWork(t, 0, kinds.length);
    expect(onlyWork).toBe(AMI_PATTERN_CHANGE_REST);
    expect(patternChangeRestMet(onlyWork)).toBe(true);
    // Strict non_work only sees trailing 720
    expect(pureNw).toBe(720);
    expect(patternChangeRestMet(pureNw)).toBe(false);
  });

  it("only-work-interrupts: work resets the trailing rest run", () => {
    const kinds: AmiTape["kinds"] = [
      ...Array(2000).fill("non_work"),
      ...Array(10).fill("work"),
      ...Array(100).fill("non_work"),
    ];
    const t = tape(kinds);
    expect(measurePatternChangeRestOnlyWorkInterrupts(t, 0, kinds.length)).toBe(100);
    expect(patternChangeRestMet(100)).toBe(false);
  });

  it("reclass-shaped fake break does not spoil only-work-interrupts", () => {
    // Simulates ≤30 reclass break in the middle of a long off-duty stretch
    const kinds: AmiTape["kinds"] = [
      ...Array(800).fill("non_work"),
      ...Array(20).fill("break"),
      ...Array(800).fill("non_work"),
    ];
    const t = tape(kinds);
    expect(measurePatternChangeRestOnlyWorkInterrupts(t, 0, kinds.length)).toBe(1620);
    expect(patternChangeRestMet(1620)).toBe(true);
    expect(measurePatternChangeRestContinuousNonWork(t, 0, kinds.length)).toBe(800);
  });
});
