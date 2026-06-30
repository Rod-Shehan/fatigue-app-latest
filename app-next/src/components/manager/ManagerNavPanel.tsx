"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import {
  MANAGER_SUBNAV_FLEET,
  MANAGER_SUBNAV_OWNER,
  MANAGER_SUBNAV_WORKSPACE,
  type NavLinkEntry,
} from "@/lib/navigation/navigation-links";
import { isOwnerRole } from "@/lib/roles";
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
  security: "Security",
};

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkClass(active: boolean, opts: { dense?: boolean; fill?: boolean }) {
  return cn(
    "inline-flex items-center rounded-lg font-medium transition-colors",
    opts.fill
      ? "flex-1 min-w-0 flex-col justify-center gap-1 px-1 py-2 text-center text-[10px] leading-tight sm:flex-row sm:gap-1.5 sm:px-2 sm:py-2.5 sm:text-xs md:text-sm"
      : cn("gap-2", opts.dense ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"),
    active
      ? "bg-teal-700 text-white shadow-sm dark:bg-teal-600"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
  );
}

function ManagerNavLink({
  item,
  pathname,
  dense,
  fill,
}: {
  item: NavLinkEntry;
  pathname: string;
  dense?: boolean;
  fill?: boolean;
}) {
  const active = isActive(pathname, item.href, item.exact);
  const Icon = SUBNAV_ICONS[item.id] ?? LayoutDashboard;
  const label = SUBNAV_LABELS[item.id] ?? item.title;

  return (
    <Link
      href={item.href}
      className={navLinkClass(active, { dense, fill })}
      aria-current={active ? "page" : undefined}
      title={label}
    >
      <Icon
        className={cn("shrink-0 opacity-90", fill ? "h-4 w-4 sm:h-3.5 sm:w-3.5" : "h-3.5 w-3.5")}
        aria-hidden
      />
      <span className={cn(fill && "line-clamp-2 sm:line-clamp-1 sm:truncate")}>{label}</span>
    </Link>
  );
}

type ManagerNavPanelProps = {
  dense?: boolean;
  /** Spread items evenly across the full header width (manager subnav bar). */
  fill?: boolean;
  className?: string;
};

export function ManagerNavPanel({
  dense = false,
  fill = true,
  className,
}: ManagerNavPanelProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string | null } | undefined)?.role;
  const isOwner = isOwnerRole(role);

  const items = useMemo(
    () => [
      ...MANAGER_SUBNAV_WORKSPACE,
      ...MANAGER_SUBNAV_FLEET,
      ...(isOwner ? MANAGER_SUBNAV_OWNER : []),
    ],
    [isOwner]
  );

  if (fill && !dense) {
    return (
      <div className={cn("flex w-full items-stretch gap-1", className)} role="list">
        {items.map((item) => (
          <ManagerNavLink key={item.href} item={item} pathname={pathname} fill />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {items.map((item) => (
        <ManagerNavLink key={item.href} item={item} pathname={pathname} dense={dense} />
      ))}
    </div>
  );
}
