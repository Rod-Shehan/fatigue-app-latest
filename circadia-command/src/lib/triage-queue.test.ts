import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "@/lib/triage-queue";

describe("triage queue cursor", () => {
  it("round-trips cursor payload", () => {
    const cursor = { lastTime: "2026-06-11T20:15:32.000Z", lastId: "9bc32c14-8812-41ee-bdf8-86d4f9bfd3cc" };
    const encoded = encodeCursor(cursor);
    expect(decodeCursor(encoded)).toEqual(cursor);
  });

  it("returns null for invalid cursor", () => {
    expect(decodeCursor("not-valid")).toBeNull();
  });
});
