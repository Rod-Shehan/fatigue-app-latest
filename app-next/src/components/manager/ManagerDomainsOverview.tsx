"use client";

import Link from "next/link";
import { Compass, FileEdit, Scale } from "lucide-react";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";

const CARD =
  "group rounded-xl border-2 p-4 shadow-sm ring-1 transition-colors";

const DOMAINS = [
  {
    href: "#risk-analysis",
    title: MANAGER_EXPERIENCE.DOMAIN_RISK_TITLE,
    blurb: MANAGER_EXPERIENCE.DOMAIN_RISK_BLURB,
    icon: Compass,
    className:
      "border-violet-300/90 bg-violet-50/50 ring-violet-200/50 hover:border-violet-400 hover:bg-violet-100/50 dark:border-violet-600/60 dark:bg-violet-950/30 dark:ring-violet-500/20 dark:hover:bg-violet-950/50",
    iconClass: "text-violet-700 dark:text-violet-400",
  },
  {
    href: "#compliance-records",
    title: MANAGER_EXPERIENCE.DOMAIN_COMPLIANCE_TITLE,
    blurb: MANAGER_EXPERIENCE.DOMAIN_COMPLIANCE_BLURB,
    icon: Scale,
    className:
      "border-amber-300/90 bg-amber-50/50 ring-amber-200/50 hover:border-amber-400 hover:bg-amber-100/50 dark:border-amber-600/50 dark:bg-amber-950/25 dark:ring-amber-500/15 dark:hover:bg-amber-950/40",
    iconClass: "text-amber-800 dark:text-amber-400",
  },
  {
    href: "#record-edits",
    title: MANAGER_EXPERIENCE.DOMAIN_EDIT_TITLE,
    blurb: MANAGER_EXPERIENCE.DOMAIN_EDIT_BLURB,
    icon: FileEdit,
    className:
      "border-teal-400/90 bg-teal-50/40 ring-teal-200/60 hover:border-teal-500 hover:bg-teal-100/50 dark:border-teal-500/50 dark:bg-teal-950/30 dark:ring-teal-500/20 dark:hover:bg-teal-950/45 sm:col-span-2 lg:col-span-1",
    iconClass: "text-teal-800 dark:text-teal-400",
  },
] as const;

export function ManagerDomainsOverview() {
  return (
    <nav
      className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Risk analysis, compliance records, and record editing"
    >
      {DOMAINS.map(({ href, title, blurb, icon: Icon, className, iconClass }) => (
        <Link key={href} href={href} className={`${CARD} ${className}`}>
          <div className="flex items-start gap-3">
            <Icon className={`h-5 w-5 shrink-0 ${iconClass}`} aria-hidden />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{blurb}</p>
            </div>
          </div>
        </Link>
      ))}
    </nav>
  );
}
