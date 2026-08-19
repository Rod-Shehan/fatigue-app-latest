import { describe, expect, it } from "vitest";
import { AMI_14D_WINDOW } from "./constants";
import { buildEvalTape, evaluateSolo14dLongRests } from "./evaluate";
import { paintAmiTape } from "./paint";
import { reclassifyAmiTape } from "./reclassify";
import type { AmiKind } from "./types";

function tapeFromKinds(kinds: AmiKind[]) {
  return reclassifyAmiTape({
    originMs: 0,
    endMs: kinds.length * 60_000,
    kinds,
  });
}

describe("solo 14-day long rests", () => {
  it("credits a 48h continuous non-work run as 2×24h", () => {
    const kinds: AmiKind[] = [
      ...Array<AmiKind>(48 * 60).fill("non_work"),
      ...Array<AmiKind>(60).fill("work"),
    ];
    const rests = evaluateSolo14dLongRests(tapeFromKinds(kinds));
    expect(rests.longRestCount).toBe(2);
    expect(rests.ok).toBe(true);
  });

  it("counts blank days on the loaded week before first work", () => {
    const recordStartMs = new Date(2026, 7, 16).getTime();
    const asOfMs = new Date(2026, 7, 19, 10, 52).getTime();
    const workTime = new Date(2026, 7, 19, 10, 51).toISOString();
    const tape = buildEvalTape(
      [{ time: workTime, type: "work" }],
      asOfMs,
      AMI_14D_WINDOW,
      { recordStartMs }
    );
    const rests = evaluateSolo14dLongRests(tape);
    expect(rests.ok).toBe(true);
    expect(rests.longRestCount).toBeGreaterThanOrEqual(2);
  });

  it("first-event clip drops pre-shift blank days (the Sherman regression)", () => {
    const asOfMs = new Date(2026, 7, 19, 10, 52).getTime();
    const workTime = new Date(2026, 7, 19, 10, 51).toISOString();
    const tape = buildEvalTape(
      [{ time: workTime, type: "work" }],
      asOfMs,
      AMI_14D_WINDOW,
      { clipToFirstEvent: true }
    );
    const rests = evaluateSolo14dLongRests(tape);
    expect(rests.ok).toBe(false);
  });
});

describe("paint before first event", () => {
  it("fills from record start as non-work until the first tap", () => {
    const origin = new Date(2026, 7, 16).getTime();
    const asOf = new Date(2026, 7, 16, 1, 0).getTime();
    const work = new Date(2026, 7, 16, 0, 30).toISOString();
    const tape = paintAmiTape([{ time: work, type: "work" }], origin, asOf);
    expect(tape.kinds.slice(0, 30).every((k) => k === "non_work")).toBe(true);
    expect(tape.kinds.slice(30, 60).every((k) => k === "work")).toBe(true);
  });
});
