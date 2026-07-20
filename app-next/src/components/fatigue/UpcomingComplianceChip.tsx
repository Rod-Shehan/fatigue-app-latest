"use client";

import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import type { ComplianceFixRoute } from "@/lib/compliance-fix-routes";
import { isComplianceFixActionable, REVIEW_DETAILS_LABEL } from "@/lib/compliance-fix-routes";
import type { UpcomingComplianceChipModel, UpcomingComplianceTone } from "@/lib/upcoming-compliance-chip";
import { driverChipShell } from "@/components/driver/driver-ui-classes";
import { cn } from "@/lib/utils";

const TITLE = "Upcoming compliance issues";

function toneStyles(tone: UpcomingComplianceTone, onDark: boolean) {
  if (onDark) {
    return tone === "attention"
      ? "border-red-400/50 bg-red-950/40 text-red-50"
      : tone === "caution"
        ? "border-amber-400/50 bg-amber-950/35 text-amber-50"
        : "border-emerald-400/40 bg-emerald-950/30 text-emerald-50";
  }
  return tone === "attention"
    ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-100"
    : tone === "caution"
      ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/35 text-amber-950 dark:text-amber-100"
      : "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100";
}

export function UpcomingComplianceChip({
  model,
  fixRoute,
  onFix,
  onOpenDetail,
  onDark = false,
  compact = false,
  className,
}: {
  model: UpcomingComplianceChipModel;
  fixRoute?: ComplianceFixRoute | null;
  onFix?: () => void;
  onOpenDetail?: () => void;
  onDark?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const Icon = model.tone === "clear" ? CheckCircle2 : AlertTriangle;
  const actionable = fixRoute != null && isComplianceFixActionable(fixRoute) && Boolean(onFix);
  const reviewOnly = fixRoute != null && !isComplianceFixActionable(fixRoute);
  const primaryLabel = actionable
    ? fixRoute!.driverLabel
    : reviewOnly
      ? REVIEW_DETAILS_LABEL
      : null;

  const shellClass = cn(
    driverChipShell,
    toneStyles(model.tone, onDark),
    compact && "py-2 px-2.5",
    className
  );

  const body = (
    <div className="flex items-start gap-2 min-w-0">
      <Icon
        className={cn(
          "shrink-0 mt-0.5",
          compact ? "h-4 w-4" : "h-5 w-5",
          model.tone === "clear" ? "opacity-90" : ""
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1 text-left space-y-2">
        <div>
          <p
            className={cn(
              "font-bold uppercase tracking-[0.12em] leading-tight",
              compact ? "text-[9px]" : "text-[10px] sm:text-[11px]"
            )}
          >
            {TITLE}
          </p>
          {model.lines.map((line) => (
            <p
              key={line}
              className={cn(
                "font-medium leading-snug mt-0.5",
                compact ? "text-[11px]" : "text-xs sm:text-sm"
              )}
            >
              {line}
            </p>
          ))}
        </div>
        {primaryLabel ? (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-semibold",
                actionable
                  ? "bg-emerald-600 text-white"
                  : "border border-current/30 bg-white/10"
              )}
            >
              {primaryLabel}
            </span>
            {actionable && onOpenDetail ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail();
                }}
                className="text-[11px] font-medium underline underline-offset-2 opacity-80 hover:opacity-100"
              >
                Details
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {!primaryLabel && onOpenDetail ? (
        <ChevronRight className={cn("shrink-0 opacity-60", compact ? "h-4 w-4" : "h-5 w-5")} aria-hidden />
      ) : null}
    </div>
  );

  if (actionable || reviewOnly) {
    const handlePrimary = () => {
      if (actionable) {
        onFix?.();
        return;
      }
      onOpenDetail?.();
    };
    return (
      <button
        type="button"
        onClick={handlePrimary}
        className={cn(
          shellClass,
          "pointer-events-auto text-left hover:brightness-[1.02] active:scale-[0.99] cursor-pointer"
        )}
        aria-label={`${TITLE}: ${model.lines.join(". ")}. ${primaryLabel}.`}
      >
        {body}
      </button>
    );
  }

  if (onOpenDetail) {
    return (
      <button
        type="button"
        onClick={onOpenDetail}
        className={cn(
          shellClass,
          "pointer-events-auto text-left hover:brightness-[1.02] active:scale-[0.99] cursor-pointer"
        )}
        aria-label={`${TITLE}: ${model.lines.join(". ")}. Open compliance details.`}
      >
        {body}
      </button>
    );
  }

  return (
    <div role="status" className={shellClass} aria-label={`${TITLE}: ${model.lines.join(". ")}`}>
      {body}
    </div>
  );
}
