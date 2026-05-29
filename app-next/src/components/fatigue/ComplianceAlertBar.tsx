"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import type { ComplianceCheckResult } from "@/lib/api";

export function ComplianceAlertBar({
  sheetId,
  loading,
  results,
}: {
  sheetId: string;
  loading?: boolean;
  results: ComplianceCheckResult[];
}) {
  const href = `/sheets/${sheetId}/compliance`;
  const violations = results.filter((r) => r.type === "violation");
  const warnings = results.filter((r) => r.type === "warning");
  const hasIssues = violations.length > 0 || warnings.length > 0;

  if (loading) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 px-3 py-2.5 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
        Checking compliance…
      </div>
    );
  }

  const title = hasIssues
    ? violations.length > 0
      ? `${violations.length} compliance issue${violations.length === 1 ? "" : "s"} need attention`
      : `${warnings.length} compliance warning${warnings.length === 1 ? "" : "s"}`
    : "Compliance check — all clear";

  const detail = hasIssues
    ? results
        .filter((r) => r.type === "violation" || r.type === "warning")
        .slice(0, 2)
        .map((r) => r.message)
        .join(" · ")
    : "Tap for work/break totals, evidence, and rule details.";

  return (
    <Link
      href={href}
      className={`mb-4 flex items-start gap-3 rounded-xl border-2 px-4 py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        violations.length > 0
          ? "border-amber-400 bg-amber-50 hover:bg-amber-100/80 dark:border-amber-600 dark:bg-amber-950/50 dark:hover:bg-amber-950/80 focus:ring-amber-400"
          : warnings.length > 0
            ? "border-amber-300 bg-amber-50/90 hover:bg-amber-100/70 dark:border-amber-700 dark:bg-amber-950/40 focus:ring-amber-400"
            : "border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100/60 dark:border-emerald-800 dark:bg-emerald-950/30 focus:ring-emerald-400"
      }`}
      aria-label={`${title}. Open full compliance check.`}
    >
      {violations.length > 0 ? (
        <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" aria-hidden />
      ) : (
        <CheckCircle2
          className={`w-5 h-5 shrink-0 mt-0.5 ${warnings.length > 0 ? "text-amber-600" : "text-emerald-600 dark:text-emerald-400"}`}
          aria-hidden
        />
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</span>
        {detail && (
          <span className="block text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">{detail}</span>
        )}
      </span>
      <span className="flex items-center gap-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shrink-0 mt-0.5">
        View
        <ChevronRight className="w-4 h-4" aria-hidden />
      </span>
    </Link>
  );
}
