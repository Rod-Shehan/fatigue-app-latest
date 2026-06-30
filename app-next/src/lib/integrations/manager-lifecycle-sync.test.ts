import { describe, expect, it } from "vitest";

// Behaviour is integration-tested against Neon in ops; unit coverage for export surface.
describe("manager-lifecycle-sync", () => {
  it("module exports sync helpers", async () => {
    const mod = await import("@/lib/integrations/manager-lifecycle-sync");
    expect(typeof mod.syncCommandLifecycleFromManagerTriage).toBe("function");
    expect(typeof mod.reconcileStalePendingLifecycleFromManagerTriage).toBe("function");
  });
});
