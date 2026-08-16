import { describe, expect, it } from "vitest";
import { CIRCADIA_DESK_PATH, circadiaDeskManifest } from "./circadia-desk";

describe("circadia desk PWA", () => {
  it("installs as a scoped desktop app, not the public website", () => {
    const manifest = circadiaDeskManifest();
    expect(manifest.start_url).toBe(CIRCADIA_DESK_PATH);
    expect(manifest.scope).toBe(CIRCADIA_DESK_PATH);
    expect(manifest.display).toBe("standalone");
    expect(manifest.display_override).toContain("window-controls-overlay");
    expect(manifest.display_override).not.toContain("fullscreen");
  });
});
