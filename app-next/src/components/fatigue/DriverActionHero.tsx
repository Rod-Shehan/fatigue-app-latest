"use client";

import React, { useMemo } from "react";
import { formatComplianceCountdown } from "@/lib/driver-action-format";
import { resolveDriverActionState } from "@/lib/driver-action-state";
import { cn } from "@/lib/utils";

export interface DriverActionHeroProps {
  workMinutesUsed: number;
  totalWindowMinutes: number;
  currentSegment: "work" | "break" | null;
  complianceLoading?: boolean;
  shiftSegmentOpen?: boolean;
  isIdleAtTop?: boolean;
  /** Geometry-only beacon — no text or tap (in-motion / passive viewing). */
  isMoving?: boolean;
  actionLabel: string;
  onAction: () => void;
  actionPending?: boolean;
  actionDisabled?: boolean;
  actionIcon?: React.ComponentType<{ className?: string }>;
  /** Elapsed work/break timer under the action label. */
  elapsedLabel?: string | null;
  /** On break while 2×10 rest not yet banked — e.g. "Rest 14/20 min". */
  breakRestProgressLabel?: string | null;
  breakRestIncomplete?: boolean;
  idleRestBlocked?: boolean;
  idleRestHelper?: string | null;
  idleRestRemainingMinutes?: number | null;
  expanded?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Expanded round primary action — Start Work / Start Break / Continue rest.
 * Button colour reflects live operational state (not sheet retrospective warnings).
 */
export const DriverActionHero: React.FC<DriverActionHeroProps> = ({
  workMinutesUsed,
  totalWindowMinutes,
  currentSegment,
  complianceLoading,
  shiftSegmentOpen,
  isIdleAtTop,
  isMoving = false,
  actionLabel,
  onAction,
  actionPending = false,
  actionDisabled = false,
  actionIcon: ActionIcon,
  elapsedLabel,
  breakRestProgressLabel,
  breakRestIncomplete = false,
  idleRestBlocked = false,
  idleRestHelper = null,
  idleRestRemainingMinutes = null,
  expanded = false,
  compact = false,
  className,
}) => {
  const action = useMemo(
    () =>
      resolveDriverActionState({
        workMinutesUsed,
        totalWindowMinutes,
        currentSegment,
        complianceLoading,
        breakRestIncomplete,
        shiftSegmentOpen,
        isIdleAtTop,
        idleRestBlocked,
      }),
    [
      workMinutesUsed,
      totalWindowMinutes,
      currentSegment,
      complianceLoading,
      breakRestIncomplete,
      shiftSegmentOpen,
      isIdleAtTop,
      idleRestBlocked,
    ]
  );

  const showWorkCountdown = !compact && !isMoving && currentSegment === "work" && !isIdleAtTop;
  const showIdleRestCountdown =
    !compact &&
    !isMoving &&
    Boolean(isIdleAtTop && idleRestBlocked && idleRestRemainingMinutes != null);
  const showCompactLabel = compact && actionPending;
  const hubLabel = actionPending ? "Tap again to confirm" : actionLabel;

  const sizeClass = expanded
    ? "size-[min(72vw,18rem)]"
    : compact
      ? "size-[4.5rem] sm:size-[5rem]"
      : "size-[min(64vw,12rem)] sm:size-[12rem]";

  const sharedSurfaceClass = cn(
    "flex flex-col items-center justify-center rounded-full font-bold transition-all duration-500 ease-out",
    action.chrome.surfaceClass,
    action.chrome.textClass,
    expanded ? "gap-1.5 px-3" : compact ? "gap-0 px-0.5" : "gap-1 px-2",
    expanded && !isMoving && "shadow-lg shadow-black/40"
  );

  if (isMoving) {
    return (
      <div className={cn("mx-auto flex shrink-0 flex-col items-center", className)}>
        <div
          className={cn(sizeClass, sharedSurfaceClass)}
          role="img"
          aria-label={`Work window ${Math.round(action.remainingMinutes)} minutes remaining`}
        />
      </div>
    );
  }

  return (
    <div className={cn("mx-auto flex shrink-0 flex-col items-center", className)}>
      <button
        type="button"
        onClick={onAction}
        disabled={actionDisabled}
        className={cn(
          sizeClass,
          sharedSurfaceClass,
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
          "active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none",
          actionPending &&
            "ring-2 ring-white ring-offset-2 ring-offset-slate-950 animate-pulse"
        )}
        aria-label={
          compact && !actionPending
            ? [
                hubLabel,
                currentSegment === "work" ? `${action.countdown} ${action.statusLabel}` : null,
                breakRestProgressLabel,
                elapsedLabel,
              ]
                .filter(Boolean)
                .join(", ")
            : hubLabel
        }
      >
        {ActionIcon ? (
          <ActionIcon
            className={cn(
              "shrink-0 drop-shadow-sm",
              expanded ? "h-11 w-11" : compact ? "h-6 w-6 sm:h-7 sm:w-7" : "h-9 w-9 sm:h-10 sm:w-10"
            )}
          />
        ) : null}
        {!compact || showCompactLabel ? (
          <span
            className={cn(
              "text-center leading-tight",
              expanded ? "text-lg sm:text-xl" : compact ? "text-[9px] leading-none" : "text-base sm:text-lg"
            )}
          >
            {hubLabel}
          </span>
        ) : null}
        {showWorkCountdown ? (
          <>
            <span
              className={cn(
                "font-black tabular-nums tracking-tight leading-none",
                expanded ? "text-3xl sm:text-4xl" : compact ? "text-[10px]" : "text-xl sm:text-2xl",
                action.chrome.onColoredSurface && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
              )}
            >
              {action.countdown}
            </span>
            <span
              className={cn(
                "uppercase tracking-[0.14em] font-semibold opacity-90 leading-tight",
                expanded ? "text-[0.6rem]" : "text-[0.55rem]",
                action.breakDueTone === "red"
                  ? "text-white"
                  : action.breakDueTone === "amber"
                    ? "text-amber-950 dark:text-white"
                    : action.chrome.onColoredSurface
                      ? "text-emerald-950/80 dark:text-white/80"
                      : "text-slate-500"
              )}
            >
              {action.statusLabel}
            </span>
          </>
        ) : null}
        {showIdleRestCountdown ? (
          <>
            <span
              className={cn(
                "font-black tabular-nums tracking-tight leading-none",
                expanded ? "text-3xl sm:text-4xl" : compact ? "text-[10px]" : "text-xl sm:text-2xl",
                "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
              )}
              aria-live="polite"
            >
              {formatComplianceCountdown(idleRestRemainingMinutes!)}
            </span>
            <span
              className={cn(
                "uppercase tracking-[0.14em] font-semibold opacity-90 leading-tight text-white/90",
                expanded ? "text-[0.6rem]" : "text-[0.55rem]"
              )}
            >
              7h rest required
            </span>
          </>
        ) : null}
        {idleRestHelper && isIdleAtTop && !showIdleRestCountdown ? (
          <span
            className={cn(
              "text-center font-semibold leading-tight opacity-90",
              expanded ? "text-xs" : "text-[10px]",
              action.chrome.onColoredSurface ? "text-white/90" : "text-slate-500"
            )}
          >
            {idleRestHelper}
          </span>
        ) : null}
        {breakRestProgressLabel &&
        !compact &&
        currentSegment === "break" &&
        !showWorkCountdown ? (
          <span
            className={cn(
              "font-semibold tabular-nums leading-tight",
              expanded ? "text-sm" : compact ? "text-[8px]" : "text-xs",
              action.chrome.onColoredSurface ? "text-white/90" : "text-slate-600"
            )}
            aria-live="polite"
          >
            {breakRestProgressLabel}
          </span>
        ) : null}
        {elapsedLabel && !compact && !showWorkCountdown && !showIdleRestCountdown ? (
          <span
            className={cn(
              "font-mono font-extrabold tabular-nums leading-none",
              expanded ? "text-lg sm:text-xl" : compact ? "text-[9px]" : "text-base sm:text-lg",
              action.chrome.onColoredSurface
                ? "drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)]"
                : "text-slate-900 dark:text-slate-100"
            )}
            aria-live="polite"
          >
            {elapsedLabel}
          </span>
        ) : null}
      </button>
    </div>
  );
};

export default DriverActionHero;
