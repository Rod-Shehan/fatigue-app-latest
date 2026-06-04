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
        className="group rounded-xl border border-violet-200/90 bg-white p-4 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50/30 dark:border-violet-800/50 dark:bg-slate-900 dark:hover:bg-violet-950/20"
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
        className="group rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition-colors hover:border-teal-300 hover:bg-teal-50/30 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-teal-950/15"
      >
        <div className="flex items-start gap-3">
          <Scale className="h-5 w-5 shrink-0 text-teal-800 dark:text-teal-400" aria-hidden />
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
