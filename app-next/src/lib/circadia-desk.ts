import { pwaIconPathsForSurface } from "@/lib/branding";

export const CIRCADIA_DESK_PATH = "/circadia";
export const CIRCADIA_DESK_HOST = "admin.circadia24.com";
export const CIRCADIA_DESK_TITLE = "Circadia24 Client Manager";
export const CIRCADIA_DESK_SHORT_NAME = "Client Manager";
export const CIRCADIA_DESK_TAGLINE = "Circadia staff desk for paying operators — desktop app, not the public website.";

/** Set after DNS + Vercel alias. Until then, /circadia on www remains a fallback. */
export function circadiaDeskPublicUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_CIRCADIA_DESK_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
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
