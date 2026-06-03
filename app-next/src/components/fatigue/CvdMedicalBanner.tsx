"use client";

import Link from "next/link";
import { AlertTriangle, Stethoscope } from "lucide-react";
import { COMMERCIAL_DRIVERS_MEDICAL, daysFromTodayToYmd, getCvdMedicalBannerKind } from "@/lib/cvd-medical";

/**
 * Banner when roster Commercial Driver's Medical date is expired or within 30 days (S7).
 */
export function CvdMedicalBanner({
  driverLabel,
  roleLabel,
  expiryYmd,
  canAccessManager,
}: {
  driverLabel: string;
  roleLabel?: string;
  expiryYmd: string | null | undefined;
  /** Show link to /drivers to edit roster. */
  canAccessManager: boolean;
}) {
  const kind = getCvdMedicalBannerKind(expiryYmd);
  if (kind === "none" || kind === "ok_no_banner") return null;

  const days = expiryYmd ? daysFromTodayToYmd(String(expiryYmd).trim()) : NaN;
  const role = roleLabel ? `${roleLabel}: ` : "";

  const base =
    "rounded-xl border px-4 py-3 min-h-[56px] text-sm flex gap-3 items-start mb-3";
  if (kind === "expired") {
    return (
      <div
        className={`${base} border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 text-red-900 dark:text-red-100`}
        role="status"
      >
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold">{COMMERCIAL_DRIVERS_MEDICAL} — expired</p>
          <p className="text-sm mt-0.5 opacity-95">
            {role}
            {driverLabel}
            {expiryYmd ? ` — was due ${expiryYmd}` : ""}. Arrange a medical assessment and update the roster.
            {Number.isFinite(days) ? ` (${days} day(s) overdue)` : ""}
          </p>
          {canAccessManager && (
            <p className="text-sm mt-1">
              <Link href="/drivers" className="font-medium underline underline-offset-2">
                Edit driver in Approved Drivers
              </Link>
            </p>
          )}
          <p className="text-[10px] mt-1.5 text-red-800/80 dark:text-red-200/80">
            Reminder only — confirm requirements with WA DoT / your medical provider.
          </p>
        </div>
      </div>
    );
  }

  /* soon */
  return (
    <div
      className={`${base} border-amber-300 bg-amber-50 dark:bg-amber-950/35 dark:border-amber-800 text-amber-950 dark:text-amber-100`}
      role="status"
    >
      <Stethoscope className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold">{COMMERCIAL_DRIVERS_MEDICAL} — renew soon</p>
        <p className="text-sm mt-0.5 opacity-95">
          {role}
          {driverLabel} — expires {expiryYmd}
          {Number.isFinite(days) ? ` (${days} day(s) remaining)` : ""}.
        </p>
        {canAccessManager && (
          <p className="text-sm mt-1">
            <Link href="/drivers" className="font-medium underline underline-offset-2">
              Update expiry in Approved Drivers
            </Link>
          </p>
        )}
        <p className="text-[10px] mt-1.5 text-amber-900/75 dark:text-amber-100/75">
          Reminder only — confirm requirements with WA DoT / your medical provider.
        </p>
      </div>
    </div>
  );
}
