"use client";

import React, { useMemo } from "react";
import { formatComplianceCountdown } from "@/lib/driver-action-format";
import { getActionRingTintClass, getResumeShiftButtonChrome } from "@/lib/driver-compliance-chrome";
import { resolveDriverActionState } from "@/lib/driver-action-state";
import { DriverActionHeroRing } from "@/components/fatigue/DriverActionHeroRing";
import { cn } from "@/lib/utils";
import { driverActionSizeClass, endShiftButtonSizeClass } from "@/lib/driver-action-sizes";
import { BedDouble, Briefcase, ClipboardList, Coffee, User, Wrench, X } from "lucide-react";
import { HERO_SPLIT_CHROME } from "@/lib/theme";

const UNLOCK_RING_R = 46;
const UNLOCK_RING_C = 2 * Math.PI * UNLOCK_RING_R;

type HeroSplitKind = "work" | "break" | "other_work" | "passenger" | "sleeper_berth" | "load_check";

const HERO_SPLIT_ICONS: Record<
  HeroSplitKind,
  React.ComponentType<{ className?: string }>
> = {
  work: Briefcase,
  break: Coffee,
  other_work: Wrench,
  passenger: User,
  sleeper_berth: BedDouble,
  load_check: ClipboardList,
};

function HeroSplitHalf({
  kind,
  edge,
  label,
  pending,
  onClick,
  disabled,
  compact,
  expanded,
  fill,
  className,
}: {
  kind: HeroSplitKind;
  edge: "top" | "bottom";
  label: string;
  pending?: boolean;
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
  expanded?: boolean;
  fill?: boolean;
  className?: string;
}) {
  const chrome = HERO_SPLIT_CHROME[kind];
  const Icon = HERO_SPLIT_ICONS[kind];
  /** Require pointerdown on this half so a retargeted click from the opener tap cannot log. */
  const armedRef = React.useRef(false);
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        if (e.button != null && e.button !== 0) return;
        armedRef.current = true;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") armedRef.current = true;
      }}
      onPointerCancel={() => {
        armedRef.current = false;
      }}
      onClick={() => {
        if (!armedRef.current) return;
        armedRef.current = false;
        onClick();
      }}
      disabled={disabled}
      className={cn(
        "relative flex w-full flex-col items-center justify-center font-bold",
        fill ? "h-full min-h-0" : "h-1/2",
        "touch-manipulation select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset",
        "disabled:opacity-60 disabled:pointer-events-none active:brightness-95",
        chrome.half,
        chrome.text,
        pending && "animate-pulse ring-2 ring-inset ring-white",
        className
      )}
      aria-label={pending ? `Tap again to confirm ${label}` : label}
    >
      <span
        className={cn(
          "absolute left-1/2 -translate-x-1/2 rounded-full",
          chrome.pip,
          compact ? "h-0.5 w-5" : "h-1 w-9",
          edge === "top" ? (compact ? "top-1" : "top-2.5") : compact ? "bottom-1" : "bottom-2.5"
        )}
        aria-hidden
      />
      {!compact ? (
        <Icon
          className={cn("shrink-0 opacity-90", expanded ? "mb-1 h-6 w-6" : "mb-0.5 h-5 w-5")}
          aria-hidden
        />
      ) : null}
      <span
        className={cn(
          "text-center leading-tight px-2",
          expanded ? "text-base sm:text-lg" : compact ? "text-[8px] leading-none" : "text-sm sm:text-base"
        )}
      >
        {pending ? "Tap again" : label}
      </span>
    </button>
  );
}

export interface DriverActionHeroProps {
  workMinutesUsed: number;
  totalWindowMinutes: number;
  currentSegment: "work" | "break" | null;
  complianceLoading?: boolean;
  shiftSegmentOpen?: boolean;
  isIdleAtTop?: boolean;
  /** GPS movement lock — keep Work/Break chrome, dim, non-tappable. */
  isMoving?: boolean;
  /** 0 just locked → 1 about to unlock (stationary dwell). */
  movementUnlockProgress01?: number;
  actionLabel: string;
  onAction: () => void;
  actionPending?: boolean;
  actionDisabled?: boolean;
  actionIcon?: React.ComponentType<{ className?: string }>;
  /** Elapsed work/break timer under the action label. */
  elapsedLabel?: string | null;
  /** What the driver is on now — Work / Rest / Other work — shown as a small note. */
  activityNowLabel?: string | null;
  /** On break while 2×10 rest not yet banked — e.g. "Rest 14/20 min". */
  breakRestProgressLabel?: string | null;
  breakRestIncomplete?: boolean;
  /** Minutes banked toward 20 — amber until 10, then lime/emerald to 20. */
  breakRestBankedMinutes?: number | null;
  idleRestBlocked?: boolean;
  idleRestHelper?: string | null;
  idleRestRemainingMinutes?: number | null;
  expanded?: boolean;
  compact?: boolean;
  className?: string;
  /** Secondary action (e.g. Resume shift) — smaller control beside/below the hero. */
  secondaryAction?: {
    label: string;
    onAction: () => void;
    pending?: boolean;
    disabled?: boolean;
  };
  /** Extra pills in the same row as secondary (e.g. View diary). */
  auxiliaryActions?: Array<{
    label: string;
    onAction: () => void;
    pending?: boolean;
    disabled?: boolean;
    icon?: React.ComponentType<{ className?: string }>;
    /** Ghost pill on dark focus overlay. */
    onDark?: boolean;
    chrome?: { surfaceClass: string; textClass: string };
  }>;
  /** Work → Stop Driving, idle → Start shift, Rest → Start work, Other work → Continue shift. */
  stopDrivingChooser?: {
    variant?: "stop-driving" | "start-shift" | "start-work" | "continue-shift" | "load-check";
    restLabel: string;
    otherWorkLabel: string;
    onStartRest: () => void;
    onStartOtherWork: () => void;
    onCancel: () => void;
    restPending?: boolean;
    otherWorkPending?: boolean;
    /** Two-up (3–4 tiles) replaces the vertical two-half split. */
    tiles?: Array<{
      kind: HeroSplitKind;
      label: string;
      onClick: () => void;
      pending?: boolean;
      disabled?: boolean;
    }>;
    ariaLabel?: string;
  } | null;
}

/**
 * Expanded round primary action — Start shift / Start work / Continue shift / Stop Driving.
 * After Start shift or Start work: vertical split Start driving / Start Other Work.
 * After Continue shift: vertical split Start driving / Start Rest.
 * After Stop Driving: vertical split Start Rest / Start Other Work.
 */
export const DriverActionHero: React.FC<DriverActionHeroProps> = ({
  workMinutesUsed,
  totalWindowMinutes,
  currentSegment,
  complianceLoading,
  shiftSegmentOpen,
  isIdleAtTop,
  isMoving = false,
  movementUnlockProgress01 = 0,
  actionLabel,
  onAction,
  actionPending = false,
  actionDisabled = false,
  actionIcon: ActionIcon,
  elapsedLabel,
  activityNowLabel = null,
  breakRestProgressLabel,
  breakRestIncomplete = false,
  breakRestBankedMinutes = null,
  idleRestBlocked = false,
  idleRestHelper = null,
  idleRestRemainingMinutes = null,
  expanded = false,
  compact = false,
  className,
  secondaryAction,
  auxiliaryActions,
  stopDrivingChooser = null,
}) => {
  const action = useMemo(
    () =>
      resolveDriverActionState({
        workMinutesUsed,
        totalWindowMinutes,
        currentSegment,
        complianceLoading,
        breakRestIncomplete,
        breakRestBankedMinutes,
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
      breakRestBankedMinutes,
      shiftSegmentOpen,
      isIdleAtTop,
      idleRestBlocked,
    ]
  );

  // Keep Work/Break countdown visible during movement lock (dimmed, not blanked).
  const showWorkCountdown = !compact && currentSegment === "work" && !isIdleAtTop;
  const showIdleRestCountdown =
    !compact && Boolean(isIdleAtTop && idleRestBlocked && idleRestRemainingMinutes != null);
  const showCompactLabel = compact && actionPending;
  const hubLabel = actionPending ? "Tap again to confirm" : actionLabel;
  const ringTintClass = getActionRingTintClass({
    complianceTone: action.operationalTone,
    breakDueTone: action.breakDueTone,
    idleRestBlocked,
    breakRestBankedMinutes: breakRestIncomplete ? breakRestBankedMinutes ?? 0 : null,
  });
  const ringSpin = currentSegment === "break" && !compact && !isMoving;
  const locked = isMoving;
  const unlockProgress = Math.min(1, Math.max(0, movementUnlockProgress01));

  const sizeClass = driverActionSizeClass(expanded, compact);
  const secondarySizeClass = endShiftButtonSizeClass(expanded, compact);
  const resumeShiftChrome = getResumeShiftButtonChrome();

  const hasAuxActions =
    Boolean(secondaryAction) || (auxiliaryActions != null && auxiliaryActions.length > 0);
  /** Compact top bar: tuck resume beside the hero circle. */
  const auxInlineCompact = compact && !expanded && Boolean(secondaryAction);

  const auxPillBase =
    "flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold transition-[filter] duration-300 ease-out touch-manipulation select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:pointer-events-none";

  const renderAuxPill = (
    key: string,
    opts: {
      label: string;
      onAction: () => void;
      pending?: boolean;
      disabled?: boolean;
      icon?: React.ComponentType<{ className?: string }>;
      onDark?: boolean;
      chrome?: { surfaceClass: string; textClass: string };
      pendingLabel?: string;
    }
  ) => {
    const Icon = opts.icon;
    const displayLabel = opts.pending ? (opts.pendingLabel ?? "Tap again") : opts.label;
    return (
      <button
        key={key}
        type="button"
        onClick={opts.onAction}
        disabled={opts.disabled}
        className={cn(
          auxPillBase,
          expanded ? "min-h-10 px-4 py-2 text-sm" : "min-h-9 px-3 py-1.5 text-xs",
          opts.onDark
            ? "border border-white/25 bg-white/10 text-white hover:bg-white/15"
            : cn(opts.chrome?.surfaceClass, opts.chrome?.textClass),
          opts.pending && "ring-2 ring-white ring-offset-2 ring-offset-slate-950 animate-pulse"
        )}
        aria-label={opts.pending ? `Tap again to confirm ${opts.label.toLowerCase()}` : opts.label}
      >
        {Icon ? (
          <Icon
            className={cn("shrink-0", opts.onDark ? "h-6 w-6 stroke-[2.75]" : "h-4 w-4 stroke-[2.5]")}
            aria-hidden
          />
        ) : null}
        <span className="whitespace-nowrap">{displayLabel}</span>
      </button>
    );
  };

  const sharedSurfaceClass = cn(
    "relative flex flex-col items-center justify-center rounded-full font-bold transition-[filter] duration-300 ease-out",
    action.chrome.surfaceClass,
    action.chrome.textClass,
    expanded ? "gap-1.5 px-3" : compact ? "gap-0 px-0.5" : "gap-1 px-2",
    locked && "opacity-70 saturate-75"
  );

  const auxActionRow =
    hasAuxActions && !auxInlineCompact ? (
      <div
        className={cn(
          "flex flex-row flex-wrap items-center justify-center gap-2",
          expanded ? "mt-3" : "mt-2.5"
        )}
      >
        {secondaryAction
          ? renderAuxPill("resume-shift", {
              label: "Resume shift",
              onAction: secondaryAction.onAction,
              pending: secondaryAction.pending,
              disabled: locked || secondaryAction.disabled,
              chrome: resumeShiftChrome,
              pendingLabel: "Tap again",
            })
          : null}
        {auxiliaryActions?.map((aux) =>
          renderAuxPill(aux.label, {
            label: aux.label,
            onAction: aux.onAction,
            pending: aux.pending,
            disabled: aux.disabled,
            icon: aux.icon,
            onDark: aux.onDark,
            chrome: aux.chrome,
          })
        )}
      </div>
    ) : null;

  const auxInlineResume = auxInlineCompact && secondaryAction ? (
    <button
      type="button"
      onClick={secondaryAction.onAction}
      disabled={locked || secondaryAction.disabled}
      className={cn(
        "flex shrink-0 flex-col items-center justify-center rounded-full font-bold transition-[filter] duration-300 ease-out",
        "touch-manipulation select-none",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
        "disabled:opacity-50 disabled:pointer-events-none",
        secondarySizeClass,
        resumeShiftChrome.surfaceClass,
        resumeShiftChrome.textClass,
        secondaryAction.pending &&
          "ring-2 ring-white ring-offset-2 ring-offset-slate-950 animate-pulse"
      )}
      aria-label={
        secondaryAction.pending ? "Tap again to confirm resume shift" : secondaryAction.label
      }
    >
      <span
        className={cn(
          "text-center leading-tight px-0.5",
          compact ? "text-[7px] leading-none" : "text-[9px] sm:text-[10px]"
        )}
      >
        {secondaryAction.pending ? "Tap again" : "Resume"}
      </span>
    </button>
  ) : null;

  const hubStackClass = cn(
    "relative z-10 flex flex-col items-center justify-center",
    expanded ? "gap-1.5" : compact ? "gap-0" : "gap-1"
  );

  const ariaParts = [
    locked ? "Logging locked while moving" : null,
    hubLabel,
    activityNowLabel ? `On ${activityNowLabel}` : null,
    currentSegment === "work" ? `${action.countdown} ${action.statusLabel}` : null,
    breakRestProgressLabel,
    elapsedLabel,
  ].filter(Boolean);

  const activityNowNoteClass = cn(
    "text-center font-medium leading-tight",
    expanded ? "text-xs" : "text-[10px]"
  );

  const chooserVariant = stopDrivingChooser?.variant ?? "stop-driving";
  const workKindSplit =
    chooserVariant === "start-shift" ||
    chooserVariant === "start-work" ||
    chooserVariant === "continue-shift";
  const chooserAria =
    stopDrivingChooser?.ariaLabel ??
    (chooserVariant === "start-work"
      ? "Start work — choose driving or Other work"
      : chooserVariant === "start-shift"
        ? "Start shift — choose driving or Other work"
        : chooserVariant === "continue-shift"
          ? "Continue shift — choose driving or Rest"
          : chooserVariant === "load-check"
            ? "Other work — load check or not a load"
            : "Stop Driving — choose Rest or Other work");
  const topKind: HeroSplitKind =
    chooserVariant === "load-check" ? "load_check" : workKindSplit ? "work" : "break";
  const bottomKind: HeroSplitKind =
    chooserVariant === "load-check"
      ? "other_work"
      : chooserVariant === "continue-shift"
        ? "break"
        : "other_work";
  const chooserTiles = stopDrivingChooser?.tiles;
  const useTileGrid = Boolean(chooserTiles && chooserTiles.length > 2);

  const heroControl = stopDrivingChooser ? (
    <div className={cn("flex flex-col items-center", locked && !useTileGrid && "opacity-70 saturate-75")}>
      <div
        className={cn(sizeClass, "relative driver-puck-shell rounded-full")}
        role="group"
        aria-label={chooserAria}
      >
        {useTileGrid && chooserTiles ? (
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 overflow-hidden rounded-full">
            {chooserTiles.map((tile, index) => (
              <HeroSplitHalf
                key={tile.label + index}
                kind={tile.kind}
                edge={index < 2 ? "top" : "bottom"}
                label={tile.label}
                pending={tile.pending}
                onClick={tile.onClick}
                disabled={tile.disabled}
                compact={compact}
                expanded={expanded}
                fill
                className={chooserTiles.length === 3 && index === 2 ? "col-span-2" : undefined}
              />
            ))}
          </div>
        ) : (
        <div className="absolute inset-0 flex flex-col overflow-hidden rounded-full">
        <HeroSplitHalf
          kind={topKind}
          edge="top"
          label={stopDrivingChooser.restLabel}
          pending={stopDrivingChooser.restPending}
          onClick={stopDrivingChooser.onStartRest}
          disabled={locked}
          compact={compact}
          expanded={expanded}
        />
        <div
          className={cn(
            "relative z-10 w-full shrink-0 bg-white",
            compact ? "h-0.5" : "h-[3px]",
            "shadow-[0_1px_0_rgba(15,23,42,0.4),0_-1px_0_rgba(15,23,42,0.4)]"
          )}
          aria-hidden
        />
        <HeroSplitHalf
          kind={bottomKind}
          edge="bottom"
          label={stopDrivingChooser.otherWorkLabel}
          pending={stopDrivingChooser.otherWorkPending}
          onClick={stopDrivingChooser.onStartOtherWork}
          disabled={locked}
          compact={compact}
          expanded={expanded}
        />
        </div>
        )}
      </div>
      {elapsedLabel || activityNowLabel ? (
        <div
          className={cn(
            "flex flex-col items-center gap-0.5",
            expanded ? "mt-2" : "mt-1.5"
          )}
        >
          {elapsedLabel ? (
            <span
              className={cn(
                "font-mono font-extrabold tabular-nums leading-none",
                expanded ? "text-lg sm:text-xl text-white" : "text-base sm:text-lg text-slate-900 dark:text-slate-100"
              )}
              aria-live="polite"
            >
              {elapsedLabel}
            </span>
          ) : null}
          {activityNowLabel ? (
            <span
              className={cn(
                activityNowNoteClass,
                expanded ? "text-white/85" : "text-slate-500 dark:text-slate-400"
              )}
              aria-live="polite"
            >
              ({activityNowLabel})
            </span>
          ) : null}
        </div>
      ) : null}
      {!locked || useTileGrid ? (
        <div className={cn(expanded ? "mt-3" : "mt-2")}>
          {renderAuxPill("chooser-cancel", {
            label: "Cancel",
            onAction: stopDrivingChooser.onCancel,
            icon: X,
            onDark: expanded,
            chrome: {
              surfaceClass:
                "border border-slate-300 bg-white shadow-sm hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-800 dark:hover:bg-slate-700",
              textClass: "text-slate-800 dark:text-slate-100",
            },
          })}
        </div>
      ) : null}
    </div>
  ) : (
      <button
        type="button"
        onClick={onAction}
        disabled={locked || actionDisabled}
        className={cn(
          sizeClass,
          sharedSurfaceClass,
          "touch-manipulation select-none",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
          "disabled:pointer-events-none",
          !locked && "disabled:opacity-60",
          actionPending &&
            !locked &&
            "ring-2 ring-white ring-offset-2 ring-offset-slate-950 animate-pulse"
        )}
        aria-label={ariaParts.join(", ")}
      >
        <DriverActionHeroRing tintClass={ringTintClass} spin={ringSpin} />
        {locked ? (
          <svg
            className="absolute inset-0 z-[1] pointer-events-none -rotate-90"
            viewBox="0 0 100 100"
            aria-hidden
          >
            <circle
              cx="50"
              cy="50"
              r={UNLOCK_RING_R}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.25}
              strokeWidth={3.5}
              className="text-white"
            />
            <circle
              cx="50"
              cy="50"
              r={UNLOCK_RING_R}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.95}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeDasharray={UNLOCK_RING_C}
              strokeDashoffset={UNLOCK_RING_C * (1 - unlockProgress)}
              className="text-white transition-[stroke-dashoffset] duration-500 ease-linear"
            />
          </svg>
        ) : null}
        <div className={hubStackClass}>
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
                  action.chrome.onColoredSurface &&
                    "drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
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
                      ? "text-white"
                      : action.chrome.onColoredSurface
                        ? "text-white/85"
                        : "text-slate-500"
                )}
              >
                {action.statusLabel}
              </span>
              {activityNowLabel ? (
                <span
                  className={cn(
                    activityNowNoteClass,
                    action.chrome.onColoredSurface ? "text-white/85" : "text-slate-500"
                  )}
                  aria-live="polite"
                >
                  ({activityNowLabel})
                </span>
              ) : null}
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
          {elapsedLabel && !compact && !showWorkCountdown && !showIdleRestCountdown ? (
            <span
              className={cn(
                "font-mono font-extrabold tabular-nums leading-none",
                expanded ? "text-lg sm:text-xl" : compact ? "text-[9px]" : "text-base sm:text-lg",
                action.chrome.onColoredSurface
                  ? "drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                  : "text-slate-900 dark:text-slate-100"
              )}
              aria-live="polite"
            >
              {elapsedLabel}
            </span>
          ) : null}
          {activityNowLabel && !compact && !showWorkCountdown ? (
            <span
              className={cn(
                activityNowNoteClass,
                action.chrome.onColoredSurface ? "text-white/85" : "text-slate-500 dark:text-slate-400"
              )}
              aria-live="polite"
            >
              ({activityNowLabel})
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
        </div>
      </button>
  );

  return (
    <div
      className={cn(
        "mx-auto flex shrink-0",
        auxInlineCompact ? "flex-row items-center gap-2" : "flex-col items-center",
        className
      )}
    >
      {heroControl}
      {locked && !compact ? (
        <p
          className={cn(
            "pointer-events-none text-center font-semibold leading-tight",
            expanded
              ? "mt-3 text-sm text-white/90"
              : "mt-2 rounded-full bg-amber-100/95 px-2.5 py-1 text-xs text-amber-950 dark:bg-amber-950/70 dark:text-amber-100"
          )}
          aria-live="polite"
        >
          Moving · pull over to unlock
        </p>
      ) : null}
      {auxInlineResume}
      {auxActionRow}
    </div>
  );
};

export default DriverActionHero;
