import { describe, expect, it } from "vitest";
import {
  isClaimedByOther,
  isClaimHeldBy,
  mapClaimRow,
  type IncidentClaimView,
} from "@/lib/integrations/incident-claim";

describe("incident-claim", () => {
  const managerClaim: IncidentClaimView = {
    lifecycleId: "a",
    claimedByActorType: "manager",
    claimedByUserId: "mgr1",
    claimedByOperatorId: null,
    claimedByLabel: "Pat M.",
    claimedAt: "2026-06-20T08:07:00.000Z",
  };

  it("detects claim holder", () => {
    expect(isClaimHeldBy(managerClaim, { type: "manager", userId: "mgr1" })).toBe(true);
    expect(isClaimedByOther(managerClaim, { type: "manager", userId: "mgr2" })).toBe(true);
  });

  it("maps operator claim rows", () => {
    const view = mapClaimRow({
      lifecycle_id: "b",
      event_status: "PENDING_TRIAGE",
      operator_id: "op1",
      claimed_by_user_id: null,
      claimed_at: new Date("2026-06-20T08:00:00.000Z"),
      claimed_by_actor_type: "command_operator",
      operator_name: "Jane K.",
      user_name: null,
      user_email: null,
    });
    expect(view.claimedByLabel).toBe("Jane K.");
    expect(view.claimedByActorType).toBe("command_operator");
  });
});
