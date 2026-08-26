"use client";

import { useMemo, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import { CircadiaLogo } from "@/components/branding/CircadiaLogo";
import { ManagerNavPanel } from "@/components/manager/ManagerNavPanel";
import { Menu, X } from "lucide-react";
import {
  MANAGER_SUBNAV_FLEET,
  MANAGER_SUBNAV_OWNER,
  MANAGER_SUBNAV_RECORDS,
  MANAGER_SUBNAV_SECURITY,
  MANAGER_SUBNAV_WORKSPACE,
} from "@/lib/navigation/navigation-links";

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function currentPageLabel(pathname: string): string {
  const groups = [
    ...MANAGER_SUBNAV_WORKSPACE,
    ...MANAGER_SUBNAV_FLEET,
    ...MANAGER_SUBNAV_OWNER,
    ...MANAGER_SUBNAV_RECORDS,
    ...MANAGER_SUBNAV_SECURITY,
  ];
  for (const item of groups) {
    if (isActive(pathname, item.href, item.exact)) {
      if (item.id === "manager-alerts") return MANAGER_EXPERIENCE.NAV_ALERTS;
      if (item.id === "overview") return MANAGER_EXPERIENCE.NAV_OVERVIEW;
      if (item.id === "map") return MANAGER_EXPERIENCE.NAV_MAP;
      if (item.id === "manager-messages") return MANAGER_EXPERIENCE.NAV_MESSAGES;
      if (item.id === "drivers") return MANAGER_EXPERIENCE.NAV_DRIVERS;
      if (item.id === "regos") return MANAGER_EXPERIENCE.NAV_REGOS;
      if (item.id === "routes") return MANAGER_EXPERIENCE.NAV_ROUTES;
      if (item.id === "manager-guide") return MANAGER_EXPERIENCE.NAV_GUIDE;
      if (item.id === "add-managers") return MANAGER_EXPERIENCE.NAV_MANAGERS;
      if (item.id === "manager-records") return MANAGER_EXPERIENCE.NAV_RECORDS;
      if (item.id === "security") return "Security";
    }
  }
  return MANAGER_EXPERIENCE.NAV_OVERVIEW;
}

type ManagerSubnavProps = {
  /**
   * On-call / live surfaces (e.g. Live alerts): collapsed menu bar by default to preserve
   * vertical space for the incident queue and video pane.
   */
  compact?: boolean;
};

export function ManagerSubnav({ compact = false }: ManagerSubnavProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const pageLabel = useMemo(() => currentPageLabel(pathname), [pathname]);

  useEffect(() => {
    if (compact) setExpanded(false);
  }, [pathname, compact]);

  const navShellClass = cn(
    "rounded-2xl border border-slate-200/90 bg-white/80 shadow-sm backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/60",
    compact ? "mb-3 p-2" : "mb-6 p-2"
  );

  if (compact && !expanded) {
    return (
      <nav
        className={cn(navShellClass, "flex items-center gap-2")}
        aria-label="Manager navigation"
      >
        <CircadiaLogo variant="icon" size={36} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
          {pageLabel}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 h-8 gap-1.5 px-2.5 text-xs"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-controls="manager-subnav-panel"
        >
          <Menu className="h-3.5 w-3.5" aria-hidden />
          Menu
        </Button>
      </nav>
    );
  }

  return (
    <nav className={navShellClass} aria-label="Manager navigation">
      {compact ? (
        <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
          <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {pageLabel}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1 px-2 text-xs text-slate-600 dark:text-slate-400"
            onClick={() => setExpanded(false)}
            aria-expanded
            aria-controls="manager-subnav-panel"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Hide
          </Button>
        </div>
      ) : null}
      <div id="manager-subnav-panel">
        <ManagerNavPanel fill={!compact} dense={compact} />
      </div>
    </nav>
  );
}
