"use client";

import React, { useMemo } from "react";
import { resolveCompliancePieState } from "@/lib/compliance-pie-state";
import { cn } from "@/lib/utils";

export interface ComplianceClockProps {
  workMinutesUsed: number;
  totalWindowMinutes: number;
  isMoving: boolean;
  className?: string;
}

/** Display-only pie (no hub action). Prefer CompliancePieHero for the driver primary control. */
export const ComplianceClock: React.FC<ComplianceClockProps> = ({
  workMinutesUsed,
  totalWindowMinutes,
  isMoving,
  className,
}) => {
  const pie = useMemo(
    () =>
      resolveCompliancePieState({
        workMinutesUsed,
        totalWindowMinutes,
        currentSegment: "work",
        shiftSegmentOpen: true,
      }),
    [workMinutesUsed, totalWindowMinutes]
  );

  return (
    <div
      className={cn(
        "w-full select-none max-w-[min(100vw-2rem,22rem)] sm:max-w-[24rem] mx-auto",
        className
      )}
      data-moving={isMoving ? "true" : "false"}
      data-tier={pie.wedgeTier}
    >
      <div
        className={cn(
          "relative aspect-square w-full rounded-full bg-slate-950",
          "ring-4 ring-slate-800/90 transition-all duration-500 ease-out",
          isMoving && "ring-[6px] ring-slate-900/80 shadow-[0_8px_32px_rgba(0,0,0,0.55)]"
        )}
        style={{ background: pie.wedgeGradient }}
        role="img"
        aria-label={
          isMoving
            ? `Work window ${Math.round(pie.remainingMinutes)} minutes remaining`
            : `${pie.statusLabel}, ${pie.countdown} remaining`
        }
      >
        {!isMoving && (
          <div
            className={cn(
              "absolute inset-[13%] flex flex-col items-center justify-center rounded-full bg-slate-950",
              "shadow-[inset_0_0_0_2px_rgba(51,65,85,0.65)] transition-all duration-500 ease-out"
            )}
            aria-hidden
          >
            <p
              className={cn(
                "px-3 text-center font-bold uppercase tracking-[0.22em] text-[clamp(0.62rem,2.8vw,0.8rem)]",
                pie.wedgeTier === "breach"
                  ? "text-red-400"
                  : pie.wedgeTier === "warning"
                    ? "text-amber-400"
                    : "text-emerald-400"
              )}
            >
              {pie.statusLabel}
            </p>
            <p className="mt-1 font-black tabular-nums text-white text-[clamp(2.75rem,14vw,4.5rem)] leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
              {pie.countdown}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComplianceClock;
