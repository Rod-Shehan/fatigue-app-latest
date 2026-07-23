import { describe, expect, it } from "vitest";
import {
  AMI_72H_MAX_GAP_BETWEEN_QUAL_BLOCKS,
  AMI_72H_QUAL_BLOCK,
  AMI_72H_WINDOW,
  evaluateSolo72h,
  type AmiTape,
} from "./index";

function tape(kinds: AmiTape["kinds"]): AmiTape {
  return { originMs: 0, endMs: kinds.length * 60_000, kinds };
}

describe("AMI solo 72h", () => {
  it("counts qualifying ≥7h non_work blocks and gap between them", () => {
    // Build: 420 nw, 100 work, 420 nw, 100 work, 420 nw — within 72h window
    const kinds: AmiTape["kinds"] = [
      ...Array(AMI_72H_QUAL_BLOCK).fill("non_work"),
      ...Array(100).fill("work"),
      ...Array(AMI_72H_QUAL_BLOCK).fill("non_work"),
      ...Array(100).fill("work"),
      ...Array(AMI_72H_QUAL_BLOCK).fill("non_work"),
      ...Array(AMI_72H_WINDOW - (AMI_72H_QUAL_BLOCK * 3 + 200)).fill("work"),
    ];
    const result = evaluateSolo72h(tape(kinds));
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
    expect(result.maxGapBetweenQualBlocks).toBeGreaterThan(AMI_72H_MAX_GAP_BETWEEN_QUAL_BLOCKS);
    expect(result.gapOk).toBe(false);
  });
});
