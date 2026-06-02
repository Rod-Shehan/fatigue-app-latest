"use client";

import Link from "next/link";
import { MANAGER_EXPERIENCE, MANAGER_TIER_STYLES } from "@/lib/manager-experience";
import type { DriverRegisterRow } from "@/lib/manager-risk-scoring";

export function ManagerDriverRegister({ rows, loading }: { rows: DriverRegisterRow[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-500">
        Building exposure register…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700">
        No driver records for this work week in compliance data yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          {MANAGER_EXPERIENCE.REGISTER_TITLE}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{MANAGER_EXPERIENCE.REGISTER_SUBTITLE}</p>
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((row) => {
          const tierStyle = MANAGER_TIER_STYLES[row.tier];
          return (
            <li key={row.sheetId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/sheets/${row.sheetId}`}
                    className="font-semibold text-slate-900 underline-offset-2 hover:underline dark:text-slate-50"
                  >
                    {row.driver}
                  </Link>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tierStyle.chip}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${tierStyle.dot}`} aria-hidden />
                    {tierStyle.label}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-400">{row.topSignal}</p>
                {row.badges.length > 0 ? (
                  <p className="mt-1 text-[10px] text-slate-500">{row.badges.map((b) => b.label).join(" · ")}</p>
                ) : null}
              </div>
              <Link
                href={`/sheets/${row.sheetId}`}
                className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-300 shrink-0"
              >
                View record →
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
