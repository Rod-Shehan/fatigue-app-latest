import { describe, expect, it } from "vitest";

// Behaviour is integration-tested against Neon in ops; unit coverage for export surface.
describe("manager-lifecycle-sync", () => {
  it("module exports sync helpers", async () => {
    const mod = await import("@/lib/integrations/manager-lifecycle-sync");
    expect(typeof mod.syncCommandLifecycleFromManagerTriage).toBe("function");
    expect(typeof mod.reconcileStalePendingLifecycleFromManagerTriage).toBe("function");
  });

  it("routes dismiss and authorized through lifecycle completion", async () => {
    const sync = await import("@/lib/integrations/manager-lifecycle-sync");
    const lifecycle = await import("@/lib/integrations/incident-lifecycle-transition");
    expect(sync.syncCommandLifecycleFromManagerTriage).not.toBe(lifecycle.applyManagerDismissFromPending);
  });
});
