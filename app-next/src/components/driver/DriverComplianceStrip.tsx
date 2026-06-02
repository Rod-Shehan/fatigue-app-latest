"use client";

import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import type { ComplianceCheckResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  driverStatusStrip,
  driverStatusStripDetail,
  driverStatusStripLabel,
} from "@/components/driver/driver-ui-classes";

export function DriverComplianceStrip({
  sheetId,
  loading,
  results,
}: {
  sheetId: string;
  loading?: boolean;
  results: ComplianceCheckResult[];
}) {
  const href = `/sheets/${sheetId}/compliance`;

  if (loading) {
    return (
      <div
        className={cn(driverStatusStrip, "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80")}
        role="status"
      >
        <Loader2 className="w-5 h-5 animate-spin shrink-0 text-slate-400" aria-hidden />
        <span className={driverStatusStripLabel}>Compliance</span>
        <span className={cn(driverStatusStripDetail, "text-slate-500")}>Checking…</span>
      </div>
    );
  }

  const violations = results.filter((r) => r.type === "violation");
  const warnings = results.filter((r) => r.type === "warning");
  const infos = results.filter((r) => r.type === "info");
  const issueCount = violations.length + warnings.length;

  let detail = "All clear";
  let tone: "ok" | "warn" | "issue" = "ok";
  if (issueCount > 0) {
    tone = violations.length > 0 ? "issue" : "warn";
    detail = `${issueCount} need attention`;
  } else if (infos.length > 0) {
    detail = `${infos.length} optional note${infos.length === 1 ? "" : "s"} — tap for details`;
  }

  return (
    <Link
      href={href}
      className={cn(
        driverStatusStrip,
        tone === "issue"
          ? "border-amber-400/80 bg-amber-50/90 hover:bg-amber-100/80 dark:border-amber-700 dark:bg-amber-950/40 focus:ring-amber-400"
          : tone === "warn"
            ? "border-amber-300/80 bg-amber-50/70 hover:bg-amber-100/60 dark:border-amber-800 dark:bg-amber-950/30 focus:ring-amber-400"
            : "border-emerald-300/80 bg-emerald-50/60 hover:bg-emerald-100/50 dark:border-emerald-800 dark:bg-emerald-950/25 focus:ring-emerald-400"
      )}
      aria-label={`Compliance: ${detail}. Open full check.`}
    >
      <span className={driverStatusStripLabel}>Compliance</span>
      <span className={driverStatusStripDetail}>{detail}</span>
      <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
    </Link>
  );
}
