"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const stripBase =
  "mb-2 flex w-full items-center gap-2 rounded-lg border px-3 py-2 min-h-[40px] text-left transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 dark:focus:ring-offset-slate-950";

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
        stripBase,
        "border-amber-300/80 bg-amber-50/70 hover:bg-amber-100/60 dark:border-amber-800 dark:bg-amber-950/30"
      )}
      aria-label={`Records: ${count} past week(s) need signature. Open settings.`}
    >
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 shrink-0">Records</span>
      <span className="flex-1 text-xs text-slate-600 dark:text-slate-400 truncate">
        {count} past week{count === 1 ? "" : "s"} need signature
      </span>
      <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" aria-hidden />
    </button>
  );
}
