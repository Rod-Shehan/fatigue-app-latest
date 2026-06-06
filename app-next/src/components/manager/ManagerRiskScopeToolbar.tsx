"use client";

import type { ReactNode } from "react";
import { Calendar } from "lucide-react";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";

/** Always-visible week / driver / day scope — sits above Fleet Risk Pulse. */
export function ManagerRiskScopeToolbar({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  return (
    <div
      className="mb-6 overflow-hidden rounded-2xl border border-teal-200/90 bg-white shadow-sm dark:border-teal-800/50 dark:bg-slate-900"
      aria-label={MANAGER_EXPERIENCE.SCOPE_TITLE}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-teal-50/90 to-white px-4 py-3 dark:border-slate-800 dark:from-teal-950/40 dark:to-slate-900 sm:px-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-teal-700 dark:text-teal-400" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              {MANAGER_EXPERIENCE.SCOPE_TITLE}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              {MANAGER_EXPERIENCE.SCOPE_RISK_INTRO}
            </p>
          </div>
        </div>
        <p
          className="max-w-md truncate rounded-lg border border-slate-200/80 bg-white/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300"
          title={summary}
        >
          {summary}
        </p>
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </div>
  );
}
