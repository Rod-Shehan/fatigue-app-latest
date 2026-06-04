"use client";

import { useState, type ReactNode } from "react";
import { Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";

export function ManagerDayPicker({
  summary,
  children,
  defaultOpen = false,
}: {
  /** One-line selection when collapsed (week · day · driver · rego). */
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80 sm:px-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-teal-700 dark:text-teal-400" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              {MANAGER_EXPERIENCE.SCOPE_TITLE}
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-400" title={summary}>
              {open ? MANAGER_EXPERIENCE.SCOPE_SUBTITLE : summary}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? (
            <>
              <ChevronUp className="h-4 w-4" aria-hidden />
              {MANAGER_EXPERIENCE.SCOPE_TOGGLE_CLOSE}
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" aria-hidden />
              {MANAGER_EXPERIENCE.SCOPE_TOGGLE_OPEN}
            </>
          )}
        </Button>
      </div>
      {open ? <div className="space-y-4 p-4 pt-4 sm:p-6 sm:pt-5">{children}</div> : null}
    </div>
  );
}
