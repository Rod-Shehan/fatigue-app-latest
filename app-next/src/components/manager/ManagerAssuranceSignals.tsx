"use client";

import Link from "next/link";
import { CheckCircle2, Info } from "lucide-react";
import { referenceCardsForMessage } from "@/lib/manager-risk-reference";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import { CompliancePolicyFootnote } from "@/components/fatigue/CompliancePolicyFootnote";
import type { GlanceBadge } from "@/lib/manager-risk-scoring";

export type AssuranceLine = {
  sheetId: string;
  driver: string;
  day: string;
  message: string;
  badges?: GlanceBadge[];
};

function AssuranceLineRow({ line }: { line: AssuranceLine }) {
  const related = referenceCardsForMessage(line.message);
  const why = related[0];

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:w-[min(100%,14rem)] sm:shrink-0">
        <Link
          href={`/sheets/${line.sheetId}`}
          className="text-sm font-semibold text-teal-900 underline-offset-2 hover:underline dark:text-teal-100"
        >
          {line.driver || "—"}
        </Link>
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {line.day}
        </span>
        {line.badges?.length ? (
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {line.badges.slice(0, 3).map((b) => (
              <span
                key={b.label}
                className={
                  b.tone === "bad"
                    ? "rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800 dark:bg-rose-900/40 dark:text-rose-100"
                    : b.tone === "warn"
                      ? "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
                      : "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }
              >
                {b.label}
              </span>
            ))}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm leading-snug text-slate-700 dark:text-slate-200">{line.message}</p>
        {why ? (
          <details className="group rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/40">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-teal-800 dark:text-teal-300 [&::-webkit-details-marker]:hidden">
              <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Why this matters for assurance
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              <span className="font-medium text-slate-800 dark:text-slate-200">{why.title}:</span>{" "}
              {why.summary}
            </p>
          </details>
        ) : null}
      </div>
    </li>
  );
}

export function ManagerAssuranceSignals({
  currentWeekLabel,
  priorWeekLabel,
  currentLines,
  priorLines,
  loading,
}: {
  currentWeekLabel: string;
  priorWeekLabel: string;
  currentLines: AssuranceLine[];
  priorLines: AssuranceLine[];
  loading?: boolean;
}) {
  return (
    <section
      className="mb-6 rounded-2xl border border-slate-200/90 bg-white dark:border-slate-700 dark:bg-slate-900/80"
      aria-label={MANAGER_EXPERIENCE.SNAPSHOT_TITLE}
    >
      <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-5">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
          {MANAGER_EXPERIENCE.SNAPSHOT_TITLE}
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {MANAGER_EXPERIENCE.SNAPSHOT_SUBTITLE}
        </p>
      </div>

      {loading ? (
        <p className="px-5 py-6 text-sm text-slate-500">Loading assurance signals…</p>
      ) : (
        <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
          <div className="px-4 py-4 sm:px-5">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {MANAGER_EXPERIENCE.CURRENT_WEEK_LABEL}
              </h3>
              <span className="text-xs font-medium tabular-nums text-slate-500">{currentWeekLabel}</span>
            </div>
            {currentLines.length === 0 ? (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-3 py-2.5 text-sm text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{MANAGER_EXPERIENCE.EMPTY_ASSURANCE}</span>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {currentLines.map((line, idx) => (
                  <AssuranceLineRow key={`${line.sheetId}-${idx}-${line.day}`} line={line} />
                ))}
              </ul>
            )}
          </div>
          <div className="px-4 py-4 sm:px-5">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {MANAGER_EXPERIENCE.PRIOR_WEEK_LABEL}
              </h3>
              <span className="text-xs font-medium tabular-nums text-slate-500">{priorWeekLabel}</span>
            </div>
            {priorLines.length === 0 ? (
              <div className="flex items-start gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <span>{MANAGER_EXPERIENCE.EMPTY_ASSURANCE}</span>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {priorLines.map((line, idx) => (
                  <AssuranceLineRow key={`prev-${line.sheetId}-${idx}-${line.day}`} line={line} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {!loading ? (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
          <CompliancePolicyFootnote variant="manager" />
        </div>
      ) : null}
    </section>
  );
}
