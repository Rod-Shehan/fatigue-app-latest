"use client";

import { MANAGER_EXPERIENCE, MANAGER_TIER_STYLES, getCircadianContext } from "@/lib/manager-experience";
import type { ManagerRiskTier } from "@/lib/manager-experience";
import { Moon, Sun, AlertCircle } from "lucide-react";

export function ManagerRiskHero({
  weekLabel,
  counts,
  loading,
}: {
  weekLabel: string;
  counts: Record<ManagerRiskTier, number>;
  loading?: boolean;
}) {
  const circadian = getCircadianContext();
  const tiers: ManagerRiskTier[] = ["attention", "elevated", "monitor", "clear"];

  return (
    <section
      className="mb-6 overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-950 via-slate-900 to-slate-950 text-white shadow-lg dark:border-teal-800/50"
      aria-label="Fleet risk summary"
    >
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-300/90">
          {MANAGER_EXPERIENCE.HERO_EYEBROW}
        </p>
        <p className="mt-1 text-sm text-teal-100/80">{weekLabel}</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
          {MANAGER_EXPERIENCE.PAGE_SUBTITLE}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
        {tiers.map((tier) => {
          const style = MANAGER_TIER_STYLES[tier];
          return (
            <div key={tier} className="bg-slate-900/40 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {style.label}
                </span>
              </div>
              <p className="mt-2 text-3xl font-bold tabular-nums text-white">
                {loading ? "—" : counts[tier]}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-start sm:gap-6 sm:px-6">
        <div className="flex min-w-0 flex-1 gap-3">
          {circadian.level === "high" ? (
            <Moon className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
          ) : circadian.level === "moderate" ? (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
          ) : (
            <Sun className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" aria-hidden />
          )}
          <div>
            <p className="text-xs font-semibold text-teal-200">{MANAGER_EXPERIENCE.CIRCADIAN_TITLE}</p>
            <p className="mt-0.5 text-sm font-medium text-white">{circadian.headline}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{circadian.detail}</p>
            <p className="mt-2 text-[10px] text-slate-500">{MANAGER_EXPERIENCE.CIRCADIAN_FOOTNOTE}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
