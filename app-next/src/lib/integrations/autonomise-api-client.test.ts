import { describe, expect, it } from "vitest";
import { buildDeviceEventMediaPath } from "@/lib/integrations/autonomise-api-client";

describe("autonomise-api-client", () => {
  it("builds documented device event media path", () => {
    expect(buildDeviceEventMediaPath("00d20574eb", "a72e581d-3c0d-4240-b093-905af32562a5")).toBe(
      "/device/00d20574eb/event/a72e581d-3c0d-4240-b093-905af32562a5/media"
    );
  });
});
