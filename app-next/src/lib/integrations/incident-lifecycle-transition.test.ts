import { describe, expect, it } from "vitest";

describe("incident-lifecycle-transition", () => {
  it("exports manager completion helpers", async () => {
    const mod = await import("@/lib/integrations/incident-lifecycle-transition");
    expect(typeof mod.transitionIncidentState).toBe("function");
    expect(typeof mod.applyManagerDismissFromPending).toBe("function");
    expect(typeof mod.applyManagerVerifiedResolutionFromPending).toBe("function");
    expect(typeof mod.listPendingLifecycleIdsForIngest).toBe("function");
  });
});
