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

const linkClass = (active: boolean, dense?: boolean) =>
  cn(
    "inline-flex items-center gap-2 rounded-lg font-medium transition-colors",
    dense ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm",
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
  dense,
}: {
  items: typeof MANAGER_SUBNAV_WORKSPACE;
  pathname: string;
  dense?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {items.map(({ id, href, exact }) => {
        const active = isActive(pathname, href, exact);
        const Icon = SUBNAV_ICONS[id] ?? LayoutDashboard;
        const label = SUBNAV_LABELS[id] ?? id;
        return (
          <Link
            key={href}
            href={href}
            className={linkClass(active, dense)}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
            {label}
          </Link>
        );
      })}
    </div>
  );
}

type ManagerNavPanelProps = {
  dense?: boolean;
  showLobby?: boolean;
  className?: string;
};

export function ManagerNavPanel({ dense = false, showLobby = true, className }: ManagerNavPanelProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string | null } | undefined)?.role;
  const isOwner = isOwnerRole(role);

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {showLobby ? <LobbyNavLink /> : null}
      <NavGroup items={MANAGER_SUBNAV_WORKSPACE} pathname={pathname} dense={dense} />
      <NavGroup items={MANAGER_SUBNAV_FLEET} pathname={pathname} dense={dense} />
      {isOwner ? (
        <NavGroup items={MANAGER_SUBNAV_OWNER} pathname={pathname} dense={dense} />
      ) : null}
    </div>
  );
}
