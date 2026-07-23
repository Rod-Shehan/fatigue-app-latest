import { describe, expect, it } from "vitest";
import {
  AMI_72H_MAX_GAP_BETWEEN_QUAL_BLOCKS,
  AMI_72H_QUAL_BLOCK,
  AMI_72H_SOFT_RESET_NO_WORK,
  AMI_72H_WINDOW,
  evaluateSolo72h,
  softResetSegmentStartMinute,
  type AmiTape,
} from "./index";

function tape(kinds: AmiTape["kinds"]): AmiTape {
  return { originMs: 0, endMs: kinds.length * 60_000, kinds };
}

describe("AMI solo 72h", () => {
  it("counts qualifying ≥7h non_work blocks and gap between them", () => {
    const kinds: AmiTape["kinds"] = [
      ...Array(AMI_72H_QUAL_BLOCK).fill("non_work"),
      ...Array(100).fill("work"),
      ...Array(AMI_72H_QUAL_BLOCK).fill("non_work"),
      ...Array(100).fill("work"),
      ...Array(AMI_72H_QUAL_BLOCK).fill("non_work"),
      ...Array(AMI_72H_WINDOW - (AMI_72H_QUAL_BLOCK * 3 + 200)).fill("work"),
    ];
    const result = evaluateSolo72h(tape(kinds));
    expect(result.applies).toBe(true);
    expect(result.qualBlockCount).toBe(3);
    expect(result.qualBlockCountOk).toBe(true);
    expect(result.maxGapBetweenQualBlocks).toBe(100);
    expect(result.gapOk).toBe(true);
  });

  it("fails gap when successive ≥7h blocks are more than 17h apart", () => {
    const gap = AMI_72H_MAX_GAP_BETWEEN_QUAL_BLOCKS + 60;
    const kinds: AmiTape["kinds"] = [
      ...Array(AMI_72H_QUAL_BLOCK).fill("non_work"),
      ...Array(gap).fill("work"),
      ...Array(AMI_72H_QUAL_BLOCK).fill("non_work"),
      ...Array(AMI_72H_QUAL_BLOCK).fill("non_work"),
      ...Array(
        Math.max(0, AMI_72H_WINDOW - (AMI_72H_QUAL_BLOCK * 3 + gap))
      ).fill("work"),
    ];
    const result = evaluateSolo72h(tape(kinds));
    expect(result.applies).toBe(true);
    expect(result.maxGapBetweenQualBlocks).toBeGreaterThan(AMI_72H_MAX_GAP_BETWEEN_QUAL_BLOCKS);
    expect(result.gapOk).toBe(false);
  });

  it("soft-resets after ≥24h continuous no-work and skips when new segment < 72h", () => {
    // Short work, then >24h green — segment after reset is shorter than 72h → inactive
    const kinds: AmiTape["kinds"] = [
      ...Array(60).fill("work"),
      ...Array(AMI_72H_SOFT_RESET_NO_WORK + 600).fill("non_work"),
    ];
    expect(softResetSegmentStartMinute(kinds)).toBe(60 + AMI_72H_SOFT_RESET_NO_WORK);
    const result = evaluateSolo72h(tape(kinds));
    expect(result.applies).toBe(false);
    expect(result.qualBlockCountOk).toBe(true);
  });

  it("does not apply on pure holiday green (no work enlivening)", () => {
    const kinds: AmiTape["kinds"] = Array(AMI_72H_WINDOW + AMI_72H_SOFT_RESET_NO_WORK).fill(
      "non_work"
    );
    const result = evaluateSolo72h(tape(kinds));
    expect(result.applies).toBe(false);
  });

  it("after 24h reset, scores only the post-reset 72h window when long enough", () => {
    // 24h green reset, then a full 72h worked pattern with 3 majors
    const post: AmiTape["kinds"] = [
      ...Array(AMI_72H_QUAL_BLOCK).fill("non_work"),
      ...Array(100).fill("work"),
      ...Array(AMI_72H_QUAL_BLOCK).fill("non_work"),
      ...Array(100).fill("work"),
      ...Array(AMI_72H_QUAL_BLOCK).fill("non_work"),
      ...Array(AMI_72H_WINDOW - (AMI_72H_QUAL_BLOCK * 3 + 200)).fill("work"),
    ];
    const kinds: AmiTape["kinds"] = [
      ...Array(AMI_72H_SOFT_RESET_NO_WORK).fill("non_work"),
      ...post,
    ];
    const result = evaluateSolo72h(tape(kinds));
    expect(result.applies).toBe(true);
    expect(result.segmentStartMinute).toBe(AMI_72H_SOFT_RESET_NO_WORK);
    expect(result.qualBlockCount).toBe(3);
    expect(result.qualBlockCountOk).toBe(true);
  });
});
