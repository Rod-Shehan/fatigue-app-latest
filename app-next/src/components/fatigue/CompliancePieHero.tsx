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
  const ringSizeClass = expanded
    ? "w-full max-w-[min(100vw-3rem,22rem)]"
    : compact
      ? "w-[4.5rem] sm:w-[5rem]"
      : "w-full max-w-[min(100vw-2rem,14rem)] sm:max-w-[12rem]";

  return (
    <div
      className={cn("mx-auto flex flex-col items-center", className)}
      data-tier={pie.wedgeTier}
      data-moving={isMoving ? "true" : "false"}
    >
      <div className={cn("relative aspect-square transition-all duration-500 ease-out", ringSizeClass)}>
        <div
          className={cn(
            "absolute inset-0 rounded-full bg-slate-950",
            "ring-4 ring-slate-800/90 transition-all duration-500 ease-out",
            isMoving && "ring-[6px] ring-slate-900/80 shadow-[0_8px_32px_rgba(0,0,0,0.55)]",
            expanded && !isMoving && "shadow-2xl shadow-emerald-500/20"
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
              "absolute inset-[12%] flex flex-col items-center justify-center rounded-full",
              "font-bold transition-all duration-500 ease-out",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
              "active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none",
              pie.chrome.surfaceClass,
              pie.chrome.textClass,
              actionPending &&
                "ring-2 ring-white ring-offset-2 ring-offset-slate-950 animate-pulse",
              expanded ? "gap-2 px-4" : compact ? "gap-0 px-1" : "gap-1.5 px-3"
            )}
            aria-label={hubLabel}
          >
            {ActionIcon ? (
              <ActionIcon
                className={cn(
                  "shrink-0 drop-shadow-sm",
                  expanded ? "h-16 w-16" : compact ? "h-5 w-5" : "h-10 w-10 sm:h-12 sm:w-12"
                )}
              />
            ) : null}
            <span
              className={cn(
                "text-center leading-tight",
                expanded ? "text-2xl sm:text-3xl" : compact ? "text-[10px] leading-none" : "text-lg sm:text-xl"
              )}
            >
              {hubLabel}
            </span>
            {showWorkCountdown ? (
              <>
                <span
                  className={cn(
                    "font-black tabular-nums tracking-tight",
                    expanded ? "text-4xl sm:text-5xl" : compact ? "text-xs" : "text-2xl sm:text-3xl",
                    pie.chrome.onColoredSurface && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                  )}
                >
                  {pie.countdown}
                </span>
                <span
                  className={cn(
                    "uppercase tracking-[0.18em] font-semibold opacity-90",
                    expanded ? "text-[0.65rem]" : "text-[0.6rem]",
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
                  "font-mono font-extrabold tabular-nums",
                  expanded ? "text-2xl" : compact ? "text-[10px]" : "text-xl sm:text-2xl",
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
