import { pwaIconPathsForSurface } from "@/lib/branding";

export const CIRCADIA_DESK_PATH = "/circadia";
/** Circadia staff desk host — not the customer Owner `/admin` console. */
export const CIRCADIA_DESK_HOST = "staff-desk.circadia24.com";
/** Old name; middleware sends this host to {@link CIRCADIA_DESK_HOST}. */
export const CIRCADIA_DESK_LEGACY_HOST = "admin.circadia24.com";
export const CIRCADIA_DESK_TITLE = "Circadia24 Staff Desk";
export const CIRCADIA_DESK_SHORT_NAME = "Staff desk";
export const CIRCADIA_DESK_TAGLINE =
  "Circadia staff desk for paying operators — desktop app, not the public website or a client Owner console.";
export const MARKETING_SITE_URL = "https://www.circadia24.com";

export function hostnameFromHostHeader(host: string | null | undefined): string {
  return host?.split(":")[0]?.trim().toLowerCase() ?? "";
}

export function isCircadiaDeskHostname(hostname: string): boolean {
  return (
    hostname === CIRCADIA_DESK_HOST ||
    hostname === "staff-desk" ||
    hostname.startsWith("staff-desk.")
  );
}

/** Previous staff host. Keep mapping so bookmarks can 301 to staff-desk. */
export function isLegacyCircadiaDeskHostname(hostname: string): boolean {
  return (
    hostname === CIRCADIA_DESK_LEGACY_HOST ||
    hostname === "admin" ||
    hostname.startsWith("admin.")
  );
}

export function circadiaDeskManifest(opts?: { hostScoped?: boolean }) {
  const icons = pwaIconPathsForSurface("circadia");
  const hostScoped = Boolean(opts?.hostScoped);
  return {
    id: hostScoped ? `https://${CIRCADIA_DESK_HOST}/` : CIRCADIA_DESK_PATH,
    name: CIRCADIA_DESK_TITLE,
    short_name: CIRCADIA_DESK_SHORT_NAME,
    description: CIRCADIA_DESK_TAGLINE,
    start_url: hostScoped ? "/" : CIRCADIA_DESK_PATH,
    scope: hostScoped ? "/" : CIRCADIA_DESK_PATH,
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
