/**
 * Product surface for multi-host deploy (soft split).
 *
 * - legacy     — combined driver + manager (parked original)
 * - ewd        — driver PWA only
 * - enterprise — manager/owner + APIs (full fleet functions; no driver lobby)
 * - circadia   — Circadia staff desk (desktop PWA on staff-desk.circadia24.com)
 *
 * Set APP_SURFACE / NEXT_PUBLIC_APP_SURFACE, or infer from Host
 * (legacy. / ewd. / enterprise. / staff-desk. subdomains).
 *
 * staff-desk.circadia24.com is Circadia staff only. Random paths go to
 * https://www.circadia24.com. Do not funnel the public site here.
 * The customer Owner console stays at /admin on Enterprise — different product.
 */

import {
  hostnameFromHostHeader,
  isCircadiaDeskHostname,
  isLegacyCircadiaDeskHostname,
  MARKETING_SITE_URL,
} from "./circadia-desk";

export type AppSurface = "legacy" | "ewd" | "enterprise" | "circadia";

export const APP_SURFACE_VALUES: AppSurface[] = ["legacy", "ewd", "enterprise", "circadia"];

export type LobbyBranchId = "driver" | "manager" | "owner";

function normalizeSurface(raw: string | undefined | null): AppSurface | null {
  const v = raw?.trim().toLowerCase();
  if (v === "legacy" || v === "v1" || v === "classic") return "legacy";
  if (v === "ewd" || v === "driver") return "ewd";
  if (v === "enterprise" || v === "manager") return "enterprise";
  if (v === "circadia" || v === "admin" || v === "staff" || v === "staff-desk") return "circadia";
  return null;
}

/** Infer surface from Host / hostname (e.g. ewd.circadia24.com). */
export function appSurfaceFromHost(host: string | null | undefined): AppSurface | null {
  if (!host) return null;
  const hostname = hostnameFromHostHeader(host);
  if (!hostname) return null;
  if (isCircadiaDeskHostname(hostname) || isLegacyCircadiaDeskHostname(hostname)) return "circadia";
  if (hostname === "legacy" || hostname.startsWith("legacy.")) return "legacy";
  if (hostname === "ewd" || hostname.startsWith("ewd.")) return "ewd";
  if (hostname === "enterprise" || hostname.startsWith("enterprise.")) return "enterprise";
  return null;
}

/**
 * Resolve active surface.
 * Priority: staff-desk host always wins (same Vercel project) → explicit env → other hosts → legacy.
 */
export function resolveAppSurface(opts?: {
  envValue?: string | null;
  publicEnvValue?: string | null;
  host?: string | null;
}): AppSurface {
  const fromHost = appSurfaceFromHost(opts?.host);
  if (fromHost === "circadia") return "circadia";
  return (
    normalizeSurface(opts?.envValue) ??
    normalizeSurface(opts?.publicEnvValue) ??
    fromHost ??
    "legacy"
  );
}

/** Server / middleware: read process env + optional Host. */
export function getAppSurface(host?: string | null): AppSurface {
  return resolveAppSurface({
    envValue: process.env.APP_SURFACE,
    publicEnvValue: process.env.NEXT_PUBLIC_APP_SURFACE,
    host,
  });
}

/** Client-safe surface (build-time public env only; host inference is middleware). */
export function getPublicAppSurface(): AppSurface {
  return resolveAppSurface({
    publicEnvValue: process.env.NEXT_PUBLIC_APP_SURFACE,
  });
}

export function appSurfaceLabel(surface: AppSurface): string {
  switch (surface) {
    case "legacy":
      return "Helper";
    case "ewd":
      return "EWD";
    case "enterprise":
      return "Enterprise";
    case "circadia":
      return "Staff desk";
  }
}

/** Browser tab / PWA short title for this product surface. */
export function documentTitleForSurface(surface: AppSurface): string {
  switch (surface) {
    case "ewd":
      return "Circadia24 EWD";
    case "enterprise":
      return "Circadia24 Enterprise";
    case "circadia":
      return "Circadia24 Staff Desk";
    case "legacy":
    default:
      return "Circadia24 Helper";
  }
}

export function documentDescriptionForSurface(surface: AppSurface): string {
  return `${documentTitleForSurface(surface)} — ${appSurfaceTagline(surface)}`;
}

export function appSurfaceTagline(surface: AppSurface): string {
  switch (surface) {
    case "legacy":
      return "Combined driver + manager app (Helper)";
    case "ewd":
      return "Electronic Work Diary — driver logging on this device";
    case "enterprise":
      return "Fleet oversight, records, and compliance processing";
    case "circadia":
      return "Circadia staff desk for paying operators — not a client Owner console";
  }
}

/** Simple name under the Circadia mark (splash / PWA). */
export function appSurfaceSimpleName(surface: AppSurface): string {
  return appSurfaceLabel(surface);
}

/** Lobby cards visible on this surface. */
export function lobbyBranchesForSurface(surface: AppSurface): LobbyBranchId[] {
  switch (surface) {
    case "ewd":
      return ["driver"];
    case "enterprise":
      return ["manager", "owner"];
    case "circadia":
      return [];
    case "legacy":
    default:
      return ["driver", "manager", "owner"];
  }
}

/**
 * Page-path gating (HTML navigations). APIs stay available on Enterprise
 * so connected EWD can sync; route handlers keep their own auth.
 */
function isPwaShellPath(path: string): boolean {
  return (
    path === "/manifest.webmanifest" ||
    path === "/sw.js" ||
    path === "/offline.html" ||
    path === "/icons" ||
    path.startsWith("/icons/")
  );
}

export function isPathAllowedOnSurface(pathname: string, surface: AppSurface): boolean {
  if (surface === "legacy") return true;

  const path = pathname.replace(/\/+$/, "") || "/";

  // Always allow public / auth / health-style pages and PWA install assets.
  if (
    path === "/" ||
    path === "/login" ||
    path === "/reset-password" ||
    path === "/access-restricted" ||
    path.startsWith("/api/") ||
    isPwaShellPath(path)
  ) {
    return true;
  }

  if (surface === "circadia") {
    return path === "/circadia" || path.startsWith("/circadia/");
  }

  if (surface === "ewd") {
    if (path === "/driver" || path.startsWith("/driver/")) return true;
    if (path === "/sheets" || path === "/sheets/new" || path.startsWith("/sheets/")) return true;
    if (path === "/messages") return true;
    return false;
  }

  // enterprise
  if (path === "/driver" || path.startsWith("/driver/")) return false;
  if (path === "/sheets" || path === "/sheets/new") return false;
  // Managers still open individual sheet records
  if (path.startsWith("/sheets/")) return true;
  if (path === "/manager" || path.startsWith("/manager/")) return true;
  if (path === "/drivers" || path.startsWith("/drivers/")) return true;
  if (path === "/admin" || path.startsWith("/admin/")) return true;
  if (path === "/circadia" || path.startsWith("/circadia/")) return true;
  if (path === "/messages") return true;
  return false;
}

export type SurfaceRedirect = {
  /** Absolute URL when sibling host is configured, else same-origin path. */
  location: string;
  external: boolean;
};

function siblingBaseUrl(surface: AppSurface): string | null {
  const raw =
    surface === "ewd"
      ? process.env.NEXT_PUBLIC_EWD_APP_URL
      : surface === "enterprise"
        ? process.env.NEXT_PUBLIC_ENTERPRISE_APP_URL
        : surface === "circadia"
          ? process.env.NEXT_PUBLIC_CIRCADIA_DESK_URL
          : process.env.NEXT_PUBLIC_LEGACY_APP_URL;
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

/**
 * Where to send a user who hit a path not allowed on the current surface.
 * Prefers the sibling product URL when configured.
 */
export function redirectForBlockedPath(
  pathname: string,
  current: AppSurface
): SurfaceRedirect {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (current === "circadia") {
    return { location: MARKETING_SITE_URL, external: true };
  }

  if (current === "ewd") {
    const enterprise = siblingBaseUrl("enterprise");
    if (enterprise && (path.startsWith("/manager") || path.startsWith("/admin") || path === "/drivers")) {
      return { location: `${enterprise}${path}`, external: true };
    }
    return { location: "/?error=surface_ewd", external: false };
  }

  if (current === "enterprise") {
    const ewd = siblingBaseUrl("ewd");
    if (ewd && (path === "/driver" || path.startsWith("/driver/") || path === "/sheets" || path === "/sheets/new")) {
      return { location: `${ewd}${path === "/sheets" || path === "/sheets/new" ? path : "/driver"}`, external: true };
    }
    return { location: "/?error=surface_enterprise", external: false };
  }

  return { location: "/", external: false };
}
