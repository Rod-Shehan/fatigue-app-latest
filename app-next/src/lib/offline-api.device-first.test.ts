import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guardrail: sheet writes must be device-first. If someone reintroduces
 * "POST/PATCH then cache", this test fails.
 */
describe("device-first write order (source guardrails)", () => {
  const offlineApi = readFileSync(join(__dirname, "offline-api.ts"), "utf8");

  it("createSheetOfflineFirst never POSTs before device confirm", () => {
    const fnStart = offlineApi.indexOf("export async function createSheetOfflineFirst");
    const fnEnd = offlineApi.indexOf("export async function listRegosOfflineFirst");
    const body = offlineApi.slice(fnStart, fnEnd);
    expect(body).toContain("confirmDeviceSheetWrite");
    expect(body).toContain("offlineEnqueue");
    // Must not short-circuit online creates with api.sheets.create first.
    const createCall = body.indexOf("api.sheets.create");
    expect(createCall).toBe(-1);
  });

  it("updateSheetOfflineFirst confirms device before runSync", () => {
    const fnStart = offlineApi.indexOf("export async function updateSheetOfflineFirst");
    const fnEnd = offlineApi.indexOf("export async function persistSheetLocalCritical");
    const body = offlineApi.slice(fnStart, fnEnd);
    const confirmAt = body.indexOf("confirmDeviceSheetWrite");
    const syncAt = body.indexOf("runSync");
    expect(confirmAt).toBeGreaterThan(-1);
    expect(syncAt).toBeGreaterThan(confirmAt);
  });
});
