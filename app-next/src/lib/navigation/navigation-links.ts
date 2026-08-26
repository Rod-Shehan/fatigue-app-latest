/**
 * Canonical navigation link manifest — single source of truth for audited surfaces.
 * Add new settings/subnav/domain links here; tests enforce audience compatibility.
 */

import { DRIVER_SETTINGS_SECTIONS } from "@/lib/driver-settings-sections";
import type { NavLinkKind, NavSurface } from "@/lib/navigation/route-access";

export type NavLinkEntry = {
  id: string;
  surface: NavSurface;
  title: string;
  href: string;
  kind?: NavLinkKind;
  description?: string;
  /** Manager subnav: exact path match for active state */
  exact?: boolean;
};

export const MANAGER_LOGIN_HREF = `/?branch=manager&callbackUrl=${encodeURIComponent("/manager")}`;

export const DRIVER_SETTINGS_DRIVE_LINKS: NavLinkEntry[] = [
  {
    id: "this-week",
    surface: "driver-settings",
    title: "This week",
    description: "Open your current week and log work",
    href: "/driver",
  },
  {
    id: "your-weeks",
    surface: "driver-settings",
    title: "Your weeks",
    description: "Past and signed weekly records",
    href: "/sheets",
  },
  {
    id: "driver-guide",
    surface: "driver-settings",
    title: "Driver guide (pictures)",
    description: "Simple English — sign in, log work, sign your week",
    href: "/driver/guide",
  },
  {
    id: "driver-help",
    surface: "driver-settings",
    title: "How your record works",
    description: "Short help and rules overview",
    href: "/driver/help",
  },
  {
    id: "route-catalogue",
    surface: "driver-settings",
    title: "Route catalogue",
    description: "Saved run plans — pick on day setup or add your own",
    href: "/driver/routes",
  },
];

export const DRIVER_SETTINGS_RECORD_LINKS: NavLinkEntry[] = DRIVER_SETTINGS_DRIVE_LINKS.filter(
  (l) => l.id === "this-week" || l.id === "your-weeks" || l.id === "route-catalogue"
);

export const DRIVER_SETTINGS_HELP_LINKS: NavLinkEntry[] = DRIVER_SETTINGS_DRIVE_LINKS.filter(
  (l) => l.id === "driver-guide" || l.id === "driver-help"
);

export const DRIVER_SETTINGS_ANCHOR_LINKS: NavLinkEntry[] = [
  {
    id: DRIVER_SETTINGS_SECTIONS.device.id,
    surface: "driver-settings",
    title: DRIVER_SETTINGS_SECTIONS.device.overviewTitle,
    href: `#${DRIVER_SETTINGS_SECTIONS.device.id}`,
    kind: "anchor",
  },
  {
    id: DRIVER_SETTINGS_SECTIONS.delivery.id,
    surface: "driver-settings",
    title: DRIVER_SETTINGS_SECTIONS.delivery.overviewTitle,
    href: `#${DRIVER_SETTINGS_SECTIONS.delivery.id}`,
    kind: "anchor",
  },
  {
    id: DRIVER_SETTINGS_SECTIONS.record.id,
    surface: "driver-settings",
    title: DRIVER_SETTINGS_SECTIONS.record.overviewTitle,
    href: `#${DRIVER_SETTINGS_SECTIONS.record.id}`,
    kind: "anchor",
  },
  {
    id: DRIVER_SETTINGS_SECTIONS.account.id,
    surface: "driver-settings",
    title: DRIVER_SETTINGS_SECTIONS.account.overviewTitle,
    href: `#${DRIVER_SETTINGS_SECTIONS.account.id}`,
    kind: "anchor",
  },
];

export const DRIVER_SETTINGS_CONNECT_LINKS: NavLinkEntry[] = [
  {
    id: "messages",
    surface: "driver-settings",
    title: "Messages",
    href: "/driver/messages",
  },
  {
    id: "manager-login",
    surface: "driver-settings",
    title: "Manager",
    description: "Manager sign-in",
    href: MANAGER_LOGIN_HREF,
    kind: "login-redirect",
  },
];

export const DRIVER_HELP_FOOTER_LINKS: NavLinkEntry[] = [
  {
    id: "help-guide",
    surface: "driver-help",
    title: "Full guide with pictures",
    href: "/driver/guide",
  },
  {
    id: "help-this-week",
    surface: "driver-help",
    title: "Open this week",
    href: "/driver",
  },
  {
    id: "help-your-weeks",
    surface: "driver-help",
    title: "Your weeks",
    href: "/sheets",
  },
];

export const MANAGER_SUBNAV_WORKSPACE: NavLinkEntry[] = [
  {
    id: "overview",
    surface: "manager-subnav",
    title: "Overview",
    href: "/manager",
    exact: true,
  },
  {
    id: "map",
    surface: "manager-subnav",
    title: "Event Tracker",
    href: "/manager/map",
  },
  {
    id: "manager-messages",
    surface: "manager-subnav",
    title: "Conversations",
    href: "/manager/messages",
  },
  {
    id: "manager-alerts",
    surface: "manager-subnav",
    title: "Live alerts",
    href: "/manager/alerts",
  },
];

export const MANAGER_SUBNAV_FLEET: NavLinkEntry[] = [
  {
    id: "drivers",
    surface: "manager-subnav",
    title: "Drivers",
    href: "/drivers",
  },
  {
    id: "regos",
    surface: "manager-subnav",
    title: "Rego",
    href: "/admin/regos",
  },
  {
    id: "routes",
    surface: "manager-subnav",
    title: "Routes",
    href: "/admin/routes",
  },
  {
    id: "manager-guide",
    surface: "manager-subnav",
    title: "User guide",
    href: "/manager/help",
  },
];

export const MANAGER_SUBNAV_OWNER: NavLinkEntry[] = [
  {
    id: "add-managers",
    surface: "manager-subnav",
    title: "Managers",
    href: "/manager/add-managers",
  },
];

/** All managers — week PDFs for audit / WAHVA. Sits to the right of Managers for owners. */
export const MANAGER_SUBNAV_RECORDS: NavLinkEntry[] = [
  {
    id: "manager-records",
    surface: "manager-subnav",
    title: "Records",
    href: "/manager/records",
  },
];

export const MANAGER_SUBNAV_SECURITY: NavLinkEntry[] = [
  {
    id: "security",
    surface: "manager-subnav",
    title: "Security",
    href: "/admin/security",
  },
];

/** Header order: workspace, fleet, Managers (owner), Records, Security (owner). */
export function managerSubnavItems(isOwner: boolean): NavLinkEntry[] {
  return [
    ...MANAGER_SUBNAV_WORKSPACE,
    ...MANAGER_SUBNAV_FLEET,
    ...(isOwner ? MANAGER_SUBNAV_OWNER : []),
    ...MANAGER_SUBNAV_RECORDS,
    ...(isOwner ? MANAGER_SUBNAV_SECURITY : []),
  ];
}

export const MANAGER_DOMAIN_ANCHOR_LINKS: NavLinkEntry[] = [
  {
    id: "risk-analysis",
    surface: "manager-domains",
    title: "1. Risk analysis",
    href: "#risk-analysis",
    kind: "anchor",
  },
  {
    id: "compliance-analysis",
    surface: "manager-domains",
    title: "2. Compliance Analysis",
    href: "#compliance-analysis",
    kind: "anchor",
  },
  {
    id: "record-edits",
    surface: "manager-domains",
    title: "3. Records & amendments",
    href: "#record-edits",
    kind: "anchor",
  },
];

export const ALL_NAVIGATION_LINKS: NavLinkEntry[] = [
  ...DRIVER_SETTINGS_DRIVE_LINKS,
  ...DRIVER_SETTINGS_CONNECT_LINKS,
  ...DRIVER_SETTINGS_ANCHOR_LINKS,
  ...DRIVER_HELP_FOOTER_LINKS,
  ...MANAGER_SUBNAV_WORKSPACE,
  ...MANAGER_SUBNAV_FLEET,
  ...MANAGER_SUBNAV_OWNER,
  ...MANAGER_SUBNAV_RECORDS,
  ...MANAGER_SUBNAV_SECURITY,
  ...MANAGER_DOMAIN_ANCHOR_LINKS,
];

/** Forbidden href prefixes on driver-facing surfaces (regression guard). */
export const DRIVER_FORBIDDEN_HREF_PREFIXES = ["/admin/", "/manager", "/drivers"] as const;
