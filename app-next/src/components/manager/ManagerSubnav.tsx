"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import { BookOpen, LayoutDashboard, Map as MapIcon, MessageSquare, Users, UserPlus, Truck } from "lucide-react";

const PRIMARY = [
  { href: "/manager", label: MANAGER_EXPERIENCE.NAV_RISK_BRIEF, icon: LayoutDashboard, exact: true as const },
  { href: "/manager/map", label: MANAGER_EXPERIENCE.NAV_MAP, icon: MapIcon, exact: false as const },
  { href: "/manager/messages", label: MANAGER_EXPERIENCE.NAV_MESSAGES, icon: MessageSquare, exact: false as const },
];

const TEAM = [
  { href: "/drivers", label: "Drivers", icon: Users },
  { href: "/manager/add-managers", label: "Managers", icon: UserPlus },
  { href: "/admin/regos", label: "Rego", icon: Truck },
  { href: "/manager/help", label: "User guide", icon: BookOpen },
] as const;

export function ManagerSubnav() {
  const pathname = usePathname();

  return (
    <nav
      className="mb-8 rounded-2xl border border-slate-200/90 bg-white/80 p-3 shadow-sm backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/60"
      aria-label="Manager navigation"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {PRIMARY.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-teal-700 text-white shadow-sm dark:bg-teal-600"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label}
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 sm:border-t-0 sm:pt-0 dark:border-slate-800">
          <span className="sr-only">{MANAGER_EXPERIENCE.NAV_TEAM}</span>
          {TEAM.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
