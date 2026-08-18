import { describe, expect, it } from "vitest";
import {
  CIRCADIA_DESK_HOST,
  CIRCADIA_DESK_PATH,
  circadiaDeskManifest,
  isCircadiaDeskHostname,
  isLegacyCircadiaDeskHostname,
} from "./circadia-desk";

describe("circadia desk PWA", () => {
  it("installs as a scoped desktop app, not the public website", () => {
    const manifest = circadiaDeskManifest();
    expect(manifest.start_url).toBe(CIRCADIA_DESK_PATH);
    expect(manifest.scope).toBe(CIRCADIA_DESK_PATH);
    expect(manifest.display).toBe("standalone");
    expect(manifest.display_override).toContain("window-controls-overlay");
    expect(manifest.display_override).not.toContain("fullscreen");
  });

  it("uses the staff-desk host as the desktop PWA identity, opening at the host root", () => {
    const manifest = circadiaDeskManifest({ hostScoped: true });
    expect(manifest.id).toBe(`https://${CIRCADIA_DESK_HOST}/`);
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
  });

  it("treats staff-desk as the desk host and admin as the legacy name", () => {
    expect(isCircadiaDeskHostname("staff-desk.circadia24.com")).toBe(true);
    expect(isCircadiaDeskHostname("admin.circadia24.com")).toBe(false);
    expect(isLegacyCircadiaDeskHostname("admin.circadia24.com")).toBe(true);
    expect(isLegacyCircadiaDeskHostname("staff-desk.circadia24.com")).toBe(false);
  });
});
