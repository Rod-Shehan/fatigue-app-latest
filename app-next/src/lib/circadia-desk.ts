import { pwaIconPathsForSurface } from "@/lib/branding";

export const CIRCADIA_DESK_PATH = "/circadia";
export const CIRCADIA_DESK_TITLE = "Circadia24 Client Manager";
export const CIRCADIA_DESK_SHORT_NAME = "Client Manager";
export const CIRCADIA_DESK_TAGLINE = "Circadia staff desk for paying operators — desktop app, not the public website.";

export function circadiaDeskManifest() {
  const icons = pwaIconPathsForSurface("legacy");
  return {
    id: CIRCADIA_DESK_PATH,
    name: CIRCADIA_DESK_TITLE,
    short_name: CIRCADIA_DESK_SHORT_NAME,
    description: CIRCADIA_DESK_TAGLINE,
    start_url: CIRCADIA_DESK_PATH,
    scope: CIRCADIA_DESK_PATH,
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "any",
    background_color: "#0A1118",
    theme_color: "#0A1118",
    icons: [
      { src: icons.icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icons.icon512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: icons.icon512Maskable, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
