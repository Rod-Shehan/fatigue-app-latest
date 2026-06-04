"use client";

import Link from "next/link";
import { Compass, Scale } from "lucide-react";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";

export function ManagerDomainsOverview() {
  return (
    <nav
      className="mb-8 grid gap-3 sm:grid-cols-2"
      aria-label="Risk analysis and compliance records"
    >
      <Link
        href="#risk-analysis"
        className="group rounded-xl border-2 border-violet-300/90 bg-violet-50/50 p-4 shadow-sm ring-1 ring-violet-200/50 transition-colors hover:border-violet-400 hover:bg-violet-100/50 dark:border-violet-600/60 dark:bg-violet-950/30 dark:ring-violet-500/20 dark:hover:bg-violet-950/50"
      >
        <div className="flex items-start gap-3">
          <Compass className="h-5 w-5 shrink-0 text-violet-700 dark:text-violet-400" aria-hidden />
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
              {MANAGER_EXPERIENCE.DOMAIN_RISK_TITLE}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {MANAGER_EXPERIENCE.DOMAIN_RISK_BLURB}
            </p>
          </div>
        </div>
      </Link>
      <Link
        href="#compliance-records"
        className="group rounded-xl border-2 border-amber-300/90 bg-amber-50/50 p-4 shadow-sm ring-1 ring-amber-200/50 transition-colors hover:border-amber-400 hover:bg-amber-100/50 dark:border-amber-600/50 dark:bg-amber-950/25 dark:ring-amber-500/15 dark:hover:bg-amber-950/40"
      >
        <div className="flex items-start gap-3">
          <Scale className="h-5 w-5 shrink-0 text-amber-800 dark:text-amber-400" aria-hidden />
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
              {MANAGER_EXPERIENCE.DOMAIN_COMPLIANCE_TITLE}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {MANAGER_EXPERIENCE.DOMAIN_COMPLIANCE_BLURB}
            </p>
          </div>
        </div>
      </Link>
    </nav>
  );
}
