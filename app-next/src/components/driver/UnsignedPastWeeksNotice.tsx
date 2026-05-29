"use client";

import Link from "next/link";
import { FileSignature } from "lucide-react";
import type { FatigueSheet } from "@/lib/api";
import { formatUnsignedPastWeeksReminderMessage } from "@/lib/product-copy";
import { formatSheetDisplayDate } from "@/lib/weeks";

/** Non-blocking reminder: past weeks need signature; current-week logging continues. */
export function UnsignedPastWeeksNotice({
  sheets,
  className = "",
}: {
  sheets: FatigueSheet[];
  className?: string;
}) {
  if (sheets.length === 0) return null;

  return (
    <div
      className={`rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 space-y-2 ${className}`}
      role="status"
    >
      <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
        {formatUnsignedPastWeeksReminderMessage(sheets.length)}
      </p>
      <ul className="space-y-1.5">
        {sheets.map((s) => (
          <li key={s.id}>
            <Link
              href={`/sheets/${s.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-100 underline underline-offset-2"
            >
              <FileSignature className="w-4 h-4 shrink-0" aria-hidden />
              Sign week of {s.week_starting ? formatSheetDisplayDate(s.week_starting) : "—"}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
