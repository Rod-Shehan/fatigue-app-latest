"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
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
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

const WORKSPACE: NavItem[] = [
  { href: "/manager", label: MANAGER_EXPERIENCE.NAV_OVERVIEW, icon: LayoutDashboard, exact: true },
  { href: "/manager/map", label: MANAGER_EXPERIENCE.NAV_MAP, icon: MapIcon },
  { href: "/manager/messages", label: MANAGER_EXPERIENCE.NAV_MESSAGES, icon: MessageSquare },
];

const FLEET_ADMIN: NavItem[] = [
  { href: "/drivers", label: MANAGER_EXPERIENCE.NAV_DRIVERS, icon: Users },
  { href: "/admin/regos", label: MANAGER_EXPERIENCE.NAV_REGOS, icon: Truck },
  { href: "/admin/routes", label: MANAGER_EXPERIENCE.NAV_ROUTES, icon: MapPin },
  { href: "/manager/help", label: MANAGER_EXPERIENCE.NAV_GUIDE, icon: BookOpen },
];

const OWNER_ONLY: NavItem[] = [
  { href: "/manager/add-managers", label: MANAGER_EXPERIENCE.NAV_MANAGERS, icon: UserPlus },
  { href: "/admin/security", label: "Organisation security", icon: Shield },
];

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

function NavGroup({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(pathname, href, exact);
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
        <NavGroup items={WORKSPACE} pathname={pathname} />
        <div
          className="hidden h-8 w-px shrink-0 bg-slate-200 sm:block dark:bg-slate-700"
          aria-hidden
        />
        <div className="h-px w-full bg-slate-100 sm:hidden dark:bg-slate-800" aria-hidden />
        <NavGroup items={FLEET_ADMIN} pathname={pathname} />
        {isOwner ? (
          <>
            <div
              className="hidden h-8 w-px shrink-0 bg-slate-200 sm:block dark:bg-slate-700"
              aria-hidden
            />
            <NavGroup items={OWNER_ONLY} pathname={pathname} />
          </>
        ) : null}
      </div>
    </nav>
  );
}
