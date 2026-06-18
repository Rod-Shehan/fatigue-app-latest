"use client";

import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { driverCollapsedRow } from "@/components/driver/driver-ui-classes";

export function DayEntryWeekGroup({
  title,
  subtitle,
  summary,
  expanded,
  onExpandedChange,
  readOnly = false,
  variant,
  children,
}: {
  title: string;
  subtitle: string;
  summary: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  readOnly?: boolean;
  variant: "past" | "future";
  children: React.ReactNode;
}) {
  const rowClass = cn(
    driverCollapsedRow,
    readOnly
      ? variant === "past"
        ? "bg-white/60 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-90"
        : "bg-slate-50/80 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800/80"
      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 active:bg-slate-100 dark:active:bg-slate-800 transition-colors"
  );

  const badgeClass =
    variant === "past"
      ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";

  const summaryLabel = readOnly
    ? `${summary}. Read only.`
    : expanded
      ? `${summary}. Tap to collapse.`
      : `${summary}. Tap to expand and edit.`;

  const inner = (
    <>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-bold uppercase tracking-wide",
          badgeClass
        )}
      >
        {variant === "past" ? "Past" : "Next"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate leading-tight">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-500 truncate">{subtitle}</p>
      </div>
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">{summary}</span>
      {!readOnly &&
        (expanded ? (
          <ChevronUp className="w-4 h-4 shrink-0 text-slate-400" aria-hidden />
        ) : (
          <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" aria-hidden />
        ))}
    </>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      {readOnly ? (
        <div className={rowClass} aria-label={`${title}. ${subtitle}. ${summaryLabel}`}>
          {inner}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          className={rowClass}
          aria-label={`${title}. ${subtitle}. ${summaryLabel}`}
          aria-expanded={expanded}
        >
          {inner}
        </button>
      )}
      {expanded && <div className="mt-2 space-y-2">{children}</div>}
    </motion.div>
  );
}
