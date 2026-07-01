import { describe, expect, it } from "vitest";
import { pilotTenantIdForQueue } from "@/lib/integrations/manager-alert-target";

describe("manager-alert-target", () => {
  it("pilotTenantIdForQueue returns null or uuid string", () => {
    const id = pilotTenantIdForQueue();
    if (id === null) {
      expect(id).toBeNull();
      return;
    }
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});
