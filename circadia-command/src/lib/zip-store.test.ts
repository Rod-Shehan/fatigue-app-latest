import { describe, expect, it } from "vitest";
import { buildStoredZip, crc32 } from "@/lib/zip-store";

describe("zip-store", () => {
  it("computes the IEEE CRC-32 of known bytes", () => {
    expect(crc32(new TextEncoder().encode("123456789")).toString(16)).toBe("cbf43926");
  });

  it("builds a ZIP that starts with a local file header", () => {
    const zip = buildStoredZip([{ name: "events.csv", data: new TextEncoder().encode("a,b\n1,2\n") }]);
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
    expect(zip.byteLength).toBeGreaterThan(80);
  });
});
