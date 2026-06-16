"use client";

import React, { useMemo } from "react";
import { resolveCompliancePieState } from "@/lib/compliance-pie-state";
import { cn } from "@/lib/utils";

export interface CompliancePieHeroProps {
  workMinutesUsed: number;
  totalWindowMinutes: number;
  currentSegment: "work" | "break" | null;
  complianceLoading?: boolean;
  hasViolations?: boolean;
  hasWarnings?: boolean;
  shiftSegmentOpen?: boolean;
  isIdleAtTop?: boolean;
  /** Geometry-only beacon — no hub text or tap (in-motion / passive viewing). */
  isMoving?: boolean;
  actionLabel: string;
  onAction: () => void;
  actionPending?: boolean;
  actionDisabled?: boolean;
  actionIcon?: React.ComponentType<{ className?: string }>;
  /** Elapsed work/break timer shown under the action label when resting. */
  elapsedLabel?: string | null;
  expanded?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Pie-ring compliance display + centre hub action — one control for status and Work/Break.
 * Colours come from the same chrome rules as LogBar (sheet compliance + 5h break-due tiers).
 */
export const CompliancePieHero: React.FC<CompliancePieHeroProps> = ({
  workMinutesUsed,
  totalWindowMinutes,
  currentSegment,
  complianceLoading,
  hasViolations,
  hasWarnings,
  shiftSegmentOpen,
  isIdleAtTop,
  isMoving = false,
  actionLabel,
  onAction,
  actionPending = false,
  actionDisabled = false,
  actionIcon: ActionIcon,
  elapsedLabel,
  expanded = false,
  compact = false,
  className,
}) => {
  const pie = useMemo(
    () =>
      resolveCompliancePieState({
        workMinutesUsed,
        totalWindowMinutes,
        currentSegment,
        complianceLoading,
        hasViolations,
        hasWarnings,
        shiftSegmentOpen,
        isIdleAtTop,
      }),
    [
      workMinutesUsed,
      totalWindowMinutes,
      currentSegment,
      complianceLoading,
      hasViolations,
      hasWarnings,
      shiftSegmentOpen,
      isIdleAtTop,
    ]
  );

  const showWorkCountdown = !isMoving && currentSegment === "work" && !isIdleAtTop;
  const hubLabel = actionPending ? "Tap again to confirm" : actionLabel;

  /** Fixed square — avoids flex stretch blowing up w-full + aspect-square. */
  const pieSizeClass = expanded
    ? "size-[min(72vw,18rem)]"
    : compact
      ? "size-[4.5rem] sm:size-[5rem]"
      : "size-[min(64vw,12rem)] sm:size-[12rem]";

  const hubInsetClass = expanded ? "inset-[16%]" : compact ? "inset-[12%]" : "inset-[14%]";

  return (
    <div
      className={cn("mx-auto flex shrink-0 flex-col items-center", className)}
      data-tier={pie.wedgeTier}
      data-moving={isMoving ? "true" : "false"}
    >
      <div className={cn("relative shrink-0 transition-all duration-500 ease-out", pieSizeClass)}>
        {/* Base track — always visible on dark focus overlay */}
        <div
          className="absolute inset-0 rounded-full bg-slate-600/70 ring-2 ring-slate-400/25"
          aria-hidden
        />
        {/* Compliance wedge */}
        <div
          className={cn(
            "absolute inset-0 rounded-full transition-all duration-500 ease-out",
            expanded && !isMoving && "shadow-lg shadow-black/40"
          )}
          style={{ background: pie.wedgeGradient }}
          aria-hidden
        />

        {!isMoving ? (
          <button
            type="button"
            onClick={onAction}
            disabled={actionDisabled}
            className={cn(
              "absolute flex flex-col items-center justify-center rounded-full",
              hubInsetClass,
              "font-bold transition-all duration-500 ease-out",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
              "active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none",
              pie.chrome.surfaceClass,
              pie.chrome.textClass,
              actionPending &&
                "ring-2 ring-white ring-offset-2 ring-offset-slate-950 animate-pulse",
              expanded ? "gap-1.5 px-3" : compact ? "gap-0 px-0.5" : "gap-1 px-2"
            )}
            aria-label={hubLabel}
          >
            {ActionIcon ? (
              <ActionIcon
                className={cn(
                  "shrink-0 drop-shadow-sm",
                  expanded ? "h-11 w-11" : compact ? "h-5 w-5" : "h-9 w-9 sm:h-10 sm:w-10"
                )}
              />
            ) : null}
            <span
              className={cn(
                "text-center leading-tight",
                expanded ? "text-lg sm:text-xl" : compact ? "text-[9px] leading-none" : "text-base sm:text-lg"
              )}
            >
              {hubLabel}
            </span>
            {showWorkCountdown ? (
              <>
                <span
                  className={cn(
                    "font-black tabular-nums tracking-tight leading-none",
                    expanded ? "text-3xl sm:text-4xl" : compact ? "text-[10px]" : "text-xl sm:text-2xl",
                    pie.chrome.onColoredSurface && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                  )}
                >
                  {pie.countdown}
                </span>
                <span
                  className={cn(
                    "uppercase tracking-[0.14em] font-semibold opacity-90 leading-tight",
                    expanded ? "text-[0.6rem]" : "text-[0.55rem]",
                    pie.breakDueTone === "red"
                      ? "text-white"
                      : pie.breakDueTone === "amber"
                        ? "text-amber-950 dark:text-white"
                        : pie.chrome.onColoredSurface
                          ? "text-emerald-950/80 dark:text-white/80"
                          : "text-slate-500"
                  )}
                >
                  {pie.statusLabel}
                </span>
              </>
            ) : null}
            {elapsedLabel ? (
              <span
                className={cn(
                  "font-mono font-extrabold tabular-nums leading-none",
                  expanded ? "text-lg sm:text-xl" : compact ? "text-[9px]" : "text-base sm:text-lg",
                  pie.chrome.onColoredSurface
                    ? "drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)]"
                    : "text-slate-900 dark:text-slate-100"
                )}
                aria-live="polite"
              >
                {elapsedLabel}
              </span>
            ) : null}
          </button>
        ) : (
          <div
            className="absolute inset-0 rounded-full"
            role="img"
            aria-label={`Work window ${Math.round(pie.remainingMinutes)} minutes remaining`}
          />
        )}
      </div>
    </div>
  );
};

export default CompliancePieHero;
