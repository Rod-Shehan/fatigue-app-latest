"use client";

import Link from "next/link";
import { FileSignature } from "lucide-react";
import { useUnsignedPastWeeks } from "@/hooks/use-unsigned-past-weeks";
import { getDisplayNameFromSession } from "@/lib/session-display-name";
import { useSession } from "next-auth/react";
import { formatSheetDisplayDate } from "@/lib/weeks";
import { driverListRow } from "@/components/driver/driver-ui-classes";

export function DriverSettingsRecordsSection({ hideHeading = false }: { hideHeading?: boolean }) {
  const { data: session } = useSession();
  const driverName = getDisplayNameFromSession(session ?? null);
  const unsigned = useUnsignedPastWeeks(driverName);

  if (unsigned.length === 0) return null;

  return (
    <section>
      {hideHeading ? null : (
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 px-1">
          Records to sign
        </h2>
      )}
      {hideHeading ? (
        <p className="px-4 pt-3 pb-0 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
          Weeks to sign
        </p>
      ) : null}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-200 dark:divide-slate-700">
        {unsigned.map((s) => (
          <Link
            key={s.id}
            href={`/sheets/${s.id}`}
            className={driverListRow}
          >
            <FileSignature className="w-5 h-5 shrink-0 text-amber-600" aria-hidden />
            <span className="flex-1 text-left leading-snug">
              Sign week of {s.week_starting ? formatSheetDisplayDate(s.week_starting) : "—"}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
