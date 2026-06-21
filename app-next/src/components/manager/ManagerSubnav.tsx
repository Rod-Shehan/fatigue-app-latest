"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import {
  MANAGER_SUBNAV_FLEET,
  MANAGER_SUBNAV_OWNER,
  MANAGER_SUBNAV_WORKSPACE,
} from "@/lib/navigation/navigation-links";
import { isOwnerRole } from "@/lib/roles";
import { LobbyNavLink } from "@/components/lobby/LobbyNavLink";
import {
  BookOpen,
  LayoutDashboard,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Shield,
  Truck,
  UserPlus,
  Users,
  Bell,
  type LucideIcon,
} from "lucide-react";

const SUBNAV_ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  map: MapIcon,
  "manager-messages": MessageSquare,
  "manager-alerts": Bell,
  drivers: Users,
  regos: Truck,
  routes: MapPin,
  "manager-guide": BookOpen,
  "add-managers": UserPlus,
  security: Shield,
};

const SUBNAV_LABELS: Record<string, string> = {
  overview: MANAGER_EXPERIENCE.NAV_OVERVIEW,
  map: MANAGER_EXPERIENCE.NAV_MAP,
  "manager-messages": MANAGER_EXPERIENCE.NAV_MESSAGES,
  "manager-alerts": MANAGER_EXPERIENCE.NAV_ALERTS,
  drivers: MANAGER_EXPERIENCE.NAV_DRIVERS,
  regos: MANAGER_EXPERIENCE.NAV_REGOS,
  routes: MANAGER_EXPERIENCE.NAV_ROUTES,
  "manager-guide": MANAGER_EXPERIENCE.NAV_GUIDE,
  "add-managers": MANAGER_EXPERIENCE.NAV_MANAGERS,
  security: "Organisation security",
};

const linkClass = (active: boolean) =>
  cn(
    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-teal-700 text-white shadow-sm dark:bg-teal-600"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
  );

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavGroup({
  items,
  pathname,
}: {
  items: typeof MANAGER_SUBNAV_WORKSPACE;
  pathname: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map(({ id, href, exact }) => {
        const active = isActive(pathname, href, exact);
        const Icon = SUBNAV_ICONS[id] ?? LayoutDashboard;
        const label = SUBNAV_LABELS[id] ?? id;
        return (
          <Link key={href} href={href} className={linkClass(active)} aria-current={active ? "page" : undefined}>
            <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            {label}
          </Link>
        );
      })}
    </div>
  );
}

export function ManagerSubnav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string | null } | undefined)?.role;
  const isOwner = isOwnerRole(role);

  return (
    <nav
      className="mb-8 rounded-2xl border border-slate-200/90 bg-white/80 p-3 shadow-sm backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/60"
      aria-label="Manager navigation"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <LobbyNavLink />
        <div
          className="hidden h-8 w-px shrink-0 bg-slate-200 sm:block dark:bg-slate-700"
          aria-hidden
        />
        <div className="h-px w-full bg-slate-100 sm:hidden dark:bg-slate-800" aria-hidden />
        <NavGroup items={MANAGER_SUBNAV_WORKSPACE} pathname={pathname} />
        <div
          className="hidden h-8 w-px shrink-0 bg-slate-200 sm:block dark:bg-slate-700"
          aria-hidden
        />
        <div className="h-px w-full bg-slate-100 sm:hidden dark:bg-slate-800" aria-hidden />
        <NavGroup items={MANAGER_SUBNAV_FLEET} pathname={pathname} />
        {isOwner ? (
          <>
            <div
              className="hidden h-8 w-px shrink-0 bg-slate-200 sm:block dark:bg-slate-700"
              aria-hidden
            />
            <NavGroup items={MANAGER_SUBNAV_OWNER} pathname={pathname} />
          </>
        ) : null}
      </div>
    </nav>
  );
}
