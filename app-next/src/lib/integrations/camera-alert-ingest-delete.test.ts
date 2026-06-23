import { afterEach, describe, expect, it } from "vitest";
import { isCameraAlertDeleteEnabled } from "@/lib/integrations/camera-alert-ingest-delete";

describe("camera-alert-ingest-delete", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("is disabled by default", () => {
    delete process.env.CAMERA_ALERTS_ALLOW_DELETE;
    expect(isCameraAlertDeleteEnabled()).toBe(false);
  });

  it("enables when CAMERA_ALERTS_ALLOW_DELETE=true", () => {
    process.env.CAMERA_ALERTS_ALLOW_DELETE = "true";
    expect(isCameraAlertDeleteEnabled()).toBe(true);
  });
});
