"use client";

import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import type { UpcomingComplianceChipModel, UpcomingComplianceTone } from "@/lib/upcoming-compliance-chip";
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
  onOpenDetail,
  onDark = false,
  compact = false,
  className,
}: {
  model: UpcomingComplianceChipModel;
  onOpenDetail?: () => void;
  onDark?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const Icon = model.tone === "clear" ? CheckCircle2 : AlertTriangle;
  const interactive = Boolean(onOpenDetail);

  const body = (
    <>
      <div className="flex items-start gap-2 min-w-0">
        <Icon
          className={cn(
            "shrink-0 mt-0.5",
            compact ? "h-4 w-4" : "h-5 w-5",
            model.tone === "clear" ? "opacity-90" : ""
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1 text-left">
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
        {interactive ? (
          <ChevronRight className={cn("shrink-0 opacity-60", compact ? "h-4 w-4" : "h-5 w-5")} aria-hidden />
        ) : null}
      </div>
    </>
  );

  const shellClass = cn(
    "w-full max-w-md rounded-xl border px-3 py-2.5 shadow-sm transition-colors",
    toneStyles(model.tone, onDark),
    interactive && "hover:brightness-[1.02] active:scale-[0.99] cursor-pointer",
    compact && "py-2 px-2.5",
    className
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onOpenDetail}
        className={cn(shellClass, "pointer-events-auto text-left")}
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
