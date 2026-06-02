"use client";

import Link from "next/link";
import { FileSignature } from "lucide-react";
import type { FatigueSheet } from "@/lib/api";
import { useUnsignedPastWeeks } from "@/hooks/use-unsigned-past-weeks";
import { getDisplayNameFromSession } from "@/lib/session-display-name";
import { useSession } from "next-auth/react";
import { formatSheetDisplayDate } from "@/lib/weeks";

export function DriverSettingsRecordsSection() {
  const { data: session } = useSession();
  const driverName = getDisplayNameFromSession(session ?? null);
  const unsigned = useUnsignedPastWeeks(driverName);

  if (unsigned.length === 0) return null;

  return (
    <section>
      <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 px-1">
        Records to sign
      </h2>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-200 dark:divide-slate-700">
        {unsigned.map((s) => (
          <Link
            key={s.id}
            href={`/sheets/${s.id}`}
            className="flex items-center gap-3 px-4 py-3.5 min-h-[52px] hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            <FileSignature className="w-5 h-5 shrink-0 text-amber-600" aria-hidden />
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Sign week of {s.week_starting ? formatSheetDisplayDate(s.week_starting) : "—"}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
