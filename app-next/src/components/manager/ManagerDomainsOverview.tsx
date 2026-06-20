"use client";

import Link from "next/link";
import { Compass, FileEdit, Scale } from "lucide-react";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import { MANAGER_DOMAIN_ANCHOR_LINKS } from "@/lib/navigation/navigation-links";
import type { DomainKpiBadge, ManagerDomainKpis } from "@/lib/manager-dashboard-kpis";
import { cn } from "@/lib/utils";

const CARD =
  "group rounded-xl border-2 p-4 shadow-sm ring-1 transition-colors";

const DOMAIN_META = {
  "risk-analysis": {
    blurb: MANAGER_EXPERIENCE.DOMAIN_RISK_BLURB,
    icon: Compass,
    className:
      "border-violet-300/90 bg-violet-50/50 ring-violet-200/50 hover:border-violet-400 hover:bg-violet-100/50 dark:border-violet-600/60 dark:bg-violet-950/30 dark:ring-violet-500/20 dark:hover:bg-violet-950/50",
    iconClass: "text-violet-700 dark:text-violet-400",
    badgeClear:
      "bg-violet-100/80 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
    badgeActive:
      "bg-violet-700 text-white dark:bg-violet-600 dark:text-violet-50",
  },
  "compliance-records": {
    blurb: MANAGER_EXPERIENCE.DOMAIN_COMPLIANCE_BLURB,
    icon: Scale,
    className:
      "border-amber-300/90 bg-amber-50/50 ring-amber-200/50 hover:border-amber-400 hover:bg-amber-100/50 dark:border-amber-600/50 dark:bg-amber-950/25 dark:ring-amber-500/15 dark:hover:bg-amber-950/40",
    iconClass: "text-amber-800 dark:text-amber-400",
    badgeClear:
      "bg-amber-100/80 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
    badgeActive:
      "bg-amber-800 text-white dark:bg-amber-600 dark:text-amber-50",
  },
  "record-edits": {
    blurb: MANAGER_EXPERIENCE.DOMAIN_EDIT_BLURB,
    icon: FileEdit,
    className:
      "border-teal-400/90 bg-teal-50/40 ring-teal-200/60 hover:border-teal-500 hover:bg-teal-100/50 dark:border-teal-500/50 dark:bg-teal-950/30 dark:ring-teal-500/20 dark:hover:bg-teal-950/45 sm:col-span-2 lg:col-span-1",
    iconClass: "text-teal-800 dark:text-teal-400",
    badgeClear:
      "bg-teal-100/80 text-teal-900 dark:bg-teal-950/50 dark:text-teal-100",
    badgeActive:
      "bg-teal-800 text-white dark:bg-teal-600 dark:text-teal-50",
  },
} as const;

function kpiForDomain(
  id: keyof typeof DOMAIN_META,
  kpis: ManagerDomainKpis
): DomainKpiBadge {
  if (id === "risk-analysis") return kpis.riskAnalysis;
  if (id === "compliance-records") return kpis.complianceRecords;
  return kpis.recordEdits;
}

function scrollToSection(id: string, href: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.replaceState(null, "", href);
}

type ManagerDomainsOverviewProps = {
  kpis: ManagerDomainKpis;
};

export function ManagerDomainsOverview({ kpis }: ManagerDomainsOverviewProps) {
  return (
    <nav
      className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Risk analysis, compliance records, and record editing"
    >
      {MANAGER_DOMAIN_ANCHOR_LINKS.map(({ id, href, title }) => {
        const meta = DOMAIN_META[id as keyof typeof DOMAIN_META];
        const Icon = meta.icon;
        const kpi = kpiForDomain(id as keyof typeof DOMAIN_META, kpis);
        const isClear = kpi.tone === "clear";
        return (
          <Link
            key={href}
            href={href}
            onClick={(e) => {
              e.preventDefault();
              scrollToSection(id, href);
            }}
            className={`${CARD} ${meta.className}`}
          >
            <div className="flex items-start gap-3">
              <Icon className={`h-5 w-5 shrink-0 ${meta.iconClass}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{title}</p>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      isClear ? meta.badgeClear : meta.badgeActive
                    )}
                  >
                    {kpi.label}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{meta.blurb}</p>
              </div>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
