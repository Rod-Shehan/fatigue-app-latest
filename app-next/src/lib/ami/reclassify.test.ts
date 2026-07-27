import { describe, expect, it } from "vitest";
import {
  AMI_LONG_BREAK_AS_NON_WORK_MIN,
  paintAmiTape,
  reclassifyAmiTape,
  type AmiEvent,
  type AmiTape,
} from "./index";

function tapeFromKinds(kinds: AmiTape["kinds"], originMs = 0): AmiTape {
  return {
    originMs,
    endMs: originMs + kinds.length * 60_000,
    kinds,
  };
}

describe("AMI reclass", () => {
  it("does not invent break from short non_work next to work", () => {
    const kinds = [
      ...Array(10).fill("work"),
      ...Array(20).fill("non_work"),
      ...Array(10).fill("work"),
    ] as AmiTape["kinds"];
    const out = reclassifyAmiTape(tapeFromKinds(kinds));
    expect(out.kinds.slice(10, 30).every((k) => k === "non_work")).toBe(true);
  });

  it("keeps short actioned break as break (≤30)", () => {
    const kinds = [
      ...Array(10).fill("work"),
      ...Array(20).fill("break"),
      ...Array(10).fill("work"),
    ] as AmiTape["kinds"];
    const out = reclassifyAmiTape(tapeFromKinds(kinds));
    expect(out.kinds.slice(10, 30).every((k) => k === "break")).toBe(true);
  });

  it("completed break <10 → work", () => {
    const kinds = [
      ...Array(20).fill("work"),
      ...Array(5).fill("break"),
      ...Array(20).fill("work"),
    ] as AmiTape["kinds"];
    const out = reclassifyAmiTape(tapeFromKinds(kinds));
    expect(out.kinds.slice(20, 25).every((k) => k === "work")).toBe(true);
  });

  it("continuous break ≥31 → non_work", () => {
    const kinds = [
      ...Array(5).fill("work"),
      ...Array(AMI_LONG_BREAK_AS_NON_WORK_MIN).fill("break"),
      ...Array(5).fill("non_work"),
    ] as AmiTape["kinds"];
    const out = reclassifyAmiTape(tapeFromKinds(kinds));
    expect(out.kinds.slice(5, 5 + AMI_LONG_BREAK_AS_NON_WORK_MIN).every((k) => k === "non_work")).toBe(
      true
    );
  });

  it("paint + reclass: stop then idle is non_work", () => {
    const origin = Date.parse("2026-07-20T00:00:00");
    const asOf = Date.parse("2026-07-20T04:00:00");
    const events: AmiEvent[] = [
      { time: "2026-07-20T01:00:00", type: "work" },
      { time: "2026-07-20T02:00:00", type: "stop" },
    ];
    const raw = paintAmiTape(events, origin, asOf);
    const out = reclassifyAmiTape(raw);
    const afterStop = Math.floor((Date.parse("2026-07-20T02:00:00") - origin) / 60_000);
    expect(out.kinds.slice(afterStop).every((k) => k === "non_work")).toBe(true);
  });

  it("paint + reclass: short gap after End shift stays non_work (not invent break)", () => {
    const origin = Date.parse("2026-07-20T00:00:00");
    const asOf = Date.parse("2026-07-20T04:00:00");
    const events: AmiEvent[] = [
      { time: "2026-07-20T01:00:00", type: "work" },
      { time: "2026-07-20T02:00:00", type: "stop" },
      { time: "2026-07-20T02:20:00", type: "work" },
    ];
    const out = reclassifyAmiTape(paintAmiTape(events, origin, asOf));
    const stopMin = Math.floor((Date.parse("2026-07-20T02:00:00") - origin) / 60_000);
    const resumeMin = Math.floor((Date.parse("2026-07-20T02:20:00") - origin) / 60_000);
    expect(out.kinds.slice(stopMin, resumeMin).every((k) => k === "non_work")).toBe(true);
    expect(out.kinds.slice(stopMin, resumeMin).some((k) => k === "break")).toBe(false);
  });
});
