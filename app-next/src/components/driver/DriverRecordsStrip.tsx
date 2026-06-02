"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  driverStatusStrip,
  driverStatusStripDetail,
  driverStatusStripLabel,
} from "@/components/driver/driver-ui-classes";

export function DriverRecordsStrip({
  count,
  onOpen,
}: {
  count: number;
  onOpen: () => void;
}) {
  if (count === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        driverStatusStrip,
        "border-amber-300/80 bg-amber-50/70 hover:bg-amber-100/60 dark:border-amber-800 dark:bg-amber-950/30"
      )}
      aria-label={`Records: ${count} past week(s) need signature. Open settings.`}
    >
      <span className={driverStatusStripLabel}>Records</span>
      <span className={driverStatusStripDetail}>
        {count} past week{count === 1 ? "" : "s"} need signature
      </span>
      <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
    </button>
  );
}
