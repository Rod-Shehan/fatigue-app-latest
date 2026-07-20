"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, Info, Loader2 } from "lucide-react";
import type { ComplianceCheckResult } from "@/lib/api";
import {
  isComplianceFixActionable,
  resolvePrimaryComplianceFixRoute,
  REVIEW_DETAILS_LABEL,
  type ComplianceFixRoute,
} from "@/lib/compliance-fix-routes";
import { driverAlertBar } from "@/components/driver/driver-ui-classes";
import { cn } from "@/lib/utils";

export function ComplianceNoticeBar({ results }: { results: ComplianceCheckResult[] }) {
  const notices = results.filter((r) => r.type === "info");
  if (notices.length === 0) return null;

  const detail = notices
    .slice(0, 2)
    .map((r) => r.message)
    .join(" · ");

  return (
    <div
      className={cn(
        driverAlertBar,
        "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80"
      )}
      role="status"
    >
      <Info className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" aria-hidden />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
          {notices.length === 1 ? "Optional note" : `${notices.length} optional notes`}
        </span>
        {detail && (
          <span className="block text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">{detail}</span>
        )}
      </span>
    </div>
  );
}

export function ComplianceAlertBar({
  sheetId,
  loading,
  results,
  isManager = false,
  onComplianceFix,
}: {
  sheetId: string;
  loading?: boolean;
  results: ComplianceCheckResult[];
  isManager?: boolean;
  onComplianceFix?: (route: ComplianceFixRoute) => void;
}) {
  const href = `/sheets/${sheetId}/compliance`;
  const violations = results.filter((r) => r.type === "violation");
  const warnings = results.filter((r) => r.type === "warning");
  const hasIssues = violations.length > 0 || warnings.length > 0;
  const issueResults = results.filter((r) => r.type === "violation" || r.type === "warning");
  const primaryFixRoute = resolvePrimaryComplianceFixRoute(
    issueResults.map((r) => ({
      message: r.message,
      type: r.type,
      scrollDayIndex: r.scrollDayIndex,
      ruleId: r.ruleId,
      day: r.day,
    }))
  );
  const actionable =
    !!onComplianceFix && primaryFixRoute != null && isComplianceFixActionable(primaryFixRoute);
  const primaryLabel = actionable
    ? isManager
      ? primaryFixRoute!.managerLabel
      : primaryFixRoute!.driverLabel
    : primaryFixRoute && !isComplianceFixActionable(primaryFixRoute)
      ? REVIEW_DETAILS_LABEL
      : null;

  if (loading) {
    return (
      <div
        className={cn(
          driverAlertBar,
          "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 text-sm text-slate-500"
        )}
      >
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
    ? issueResults
        .slice(0, 2)
        .map((r) => r.message)
        .join(" · ")
    : "Tap for work/break totals, evidence, and rule details.";

  const shellClass = cn(
    driverAlertBar,
    "border-2",
    violations.length > 0
      ? "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/50"
      : warnings.length > 0
        ? "border-amber-300 bg-amber-50/90 dark:border-amber-700 dark:bg-amber-950/40"
        : "border-emerald-300 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/30"
  );

  const icon =
    violations.length > 0 ? (
      <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" aria-hidden />
    ) : (
      <CheckCircle2
        className={`w-5 h-5 shrink-0 mt-0.5 ${warnings.length > 0 ? "text-amber-600" : "text-emerald-600 dark:text-emerald-400"}`}
        aria-hidden
      />
    );

  const handlePrimary = () => {
    if (!primaryFixRoute || !onComplianceFix) return;
    onComplianceFix(primaryFixRoute);
  };

  if (primaryLabel && onComplianceFix) {
    return (
      <div className={shellClass} role="alert">
        {icon}
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</span>
          {detail ? (
            <span className="block text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">{detail}</span>
          ) : null}
        </span>
        <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handlePrimary}
            className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            {primaryLabel}
          </button>
          <Link
            href={href}
            className="inline-flex items-center justify-center gap-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:underline"
          >
            Details
            <ChevronRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        shellClass,
        "hover:bg-amber-100/80 dark:hover:bg-amber-950/80 focus:ring-amber-400"
      )}
      aria-label={`${title}. Open full compliance check.`}
    >
      {icon}
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
