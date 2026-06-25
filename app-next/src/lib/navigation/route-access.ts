/**
 * Route audience registry for navigation link audits.
 * Keep in sync with page-level gates (DriverAccessGate, getManagerSession redirects).
 */

export type RouteAudience = "public" | "driver" | "manager" | "owner" | "shared" | "anchor";

export type ParsedHref =
  | { kind: "anchor"; anchor: string }
  | { kind: "login"; pathname: string; searchParams: URLSearchParams }
  | { kind: "path"; pathname: string }
  | { kind: "external" };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Section IDs on /manager — domain overview cards must target these. */
export const MANAGER_PAGE_SECTION_IDS = [
  "risk-analysis",
  "compliance-analysis",
  "record-edits",
  "manager-check-ins",
] as const;

export type ManagerPageSectionId = (typeof MANAGER_PAGE_SECTION_IDS)[number];

export function parseHref(href: string): ParsedHref {
  const trimmed = href.trim();
  if (trimmed.startsWith("#")) {
    return { kind: "anchor", anchor: trimmed.slice(1) };
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return { kind: "external" };
  }

  const pathPart = trimmed.split("?")[0] ?? trimmed;
  const query = trimmed.includes("?") ? trimmed.slice(trimmed.indexOf("?") + 1) : "";
  const pathname = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;

  if (query) {
    return { kind: "login", pathname, searchParams: new URLSearchParams(query) };
  }
  return { kind: "path", pathname };
}

export function resolveRouteAudience(href: string): RouteAudience {
  const parsed = parseHref(href);

  if (parsed.kind === "external") {
    return "public";
  }
  if (parsed.kind === "anchor") {
    return "anchor";
  }
  if (parsed.kind === "login") {
    return "public";
  }

  const path = parsed.pathname.replace(/\/+$/, "") || "/";

  if (path === "/" || path === "/login") return "public";
  if (path === "/admin/security" || path === "/manager/add-managers") return "owner";
  if (path.startsWith("/admin/")) return "manager";
  if (path.startsWith("/manager/") || path === "/manager") return "manager";
  if (path === "/drivers") return "manager";
  if (path.startsWith("/driver/") || path === "/driver") return "driver";
  if (path === "/sheets" || path === "/sheets/new") return "driver";
  if (new RegExp(`^/sheets/${UUID}$`).test(path)) return "shared";
  if (new RegExp(`^/sheets/${UUID}/compliance$`).test(path)) return "shared";
  if (new RegExp(`^/sheets/${UUID}/shift-log$`).test(path)) return "shared";

  return "public";
}

export type NavSurface =
  | "driver-settings"
  | "driver-help"
  | "manager-subnav"
  | "manager-domains";

const SURFACE_AUDIENCE: Record<NavSurface, "driver" | "manager"> = {
  "driver-settings": "driver",
  "driver-help": "driver",
  "manager-subnav": "manager",
  "manager-domains": "manager",
};

export type NavLinkKind = "route" | "login-redirect" | "anchor";

export function isLinkAllowedOnSurface(
  href: string,
  surface: NavSurface,
  kind: NavLinkKind = "route"
): { ok: true } | { ok: false; reason: string } {
  const parsed = parseHref(href);
  const linkAudience = resolveRouteAudience(href);
  const surfaceAudience = SURFACE_AUDIENCE[surface];

  if (parsed.kind === "external") {
    return { ok: false, reason: "External hrefs are not allowed in app navigation manifests" };
  }

  if (parsed.kind === "anchor") {
    if (kind !== "anchor") {
      return { ok: false, reason: "Anchor href must use kind: anchor" };
    }
    if (surface !== "manager-domains") {
      return { ok: false, reason: "Anchors are only used on manager-domains surface" };
    }
    if (!MANAGER_PAGE_SECTION_IDS.includes(parsed.anchor as ManagerPageSectionId)) {
      return { ok: false, reason: `Unknown section anchor #${parsed.anchor}` };
    }
    return { ok: true };
  }

  if (kind === "login-redirect") {
    if (parsed.kind !== "login" || parsed.pathname !== "/") {
      return { ok: false, reason: "login-redirect must be /?branch=…&callbackUrl=…" };
    }
    if (surfaceAudience === "driver") {
      return { ok: true };
    }
    return { ok: false, reason: "login-redirect links belong on driver surfaces only" };
  }

  if (kind === "anchor") {
    return { ok: false, reason: "Non-anchor href cannot use kind: anchor" };
  }

  if (surfaceAudience === "driver") {
    if (linkAudience === "manager" || linkAudience === "owner") {
      return {
        ok: false,
        reason: `Driver surface cannot link to ${linkAudience}-only route ${href}`,
      };
    }
    return { ok: true };
  }

  if (surfaceAudience === "manager") {
    if (linkAudience === "driver" && !href.startsWith("/sheets/")) {
      return {
        ok: false,
        reason: `Manager surface should not link to driver-only route ${href}`,
      };
    }
    return { ok: true };
  }

  return { ok: true };
}
