"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSession } from "next-auth/react";
import { formatRoleBadge, getDisplayNameFromSession } from "@/lib/session-display-name";

/**
 * Consistent page header across the app.
 * - Large back arrow on the left: goes to current sheet page when in sheet context (e.g. shift-log → sheet),
 *   otherwise to Your Sheets (/sheets).
 * - Optional icon, title, subtitle, and right-side actions.
 */
export function PageHeader({
  backHref,
  backLabel = "Your Sheets",
  title,
  subtitle,
  icon,
  actions,
  driverDisplayName,
  /** @deprecated Kept for call-site compatibility. */
  roleDisplayLabel,
}: {
  /** If set, shows a back link. Use /sheets for Your Sheets, /sheets/[id] for current sheet. */
  backHref?: string;
  /** Accessible label for the back link (e.g. "Your Sheets" or "Fatigue Record"). */
  backLabel?: string;
  title: string;
  subtitle?: string;
  /** Optional icon shown in a rounded box next to the title. */
  icon?: React.ReactNode;
  /** Optional content on the right (buttons, badges, etc.). */
  actions?: React.ReactNode;
  /**
   * Driver role: name after "Driver ·" in the title pill. Falls back to session name if omitted.
   * Manager role: ignored (badge uses logged-in manager name).
   */
  driverDisplayName?: string | null;
  /** @deprecated Kept for call-site compatibility. */
  roleDisplayLabel?: string | null;
}) {
  const { data: session } = useSession();
  const role = (session?.user as unknown as { role?: string | null } | undefined)?.role ?? null;
  /** Most drivers have no DB role (null); only managers have role === "manager". */
  const isManager = role === "manager";
  const sessionDisplayName = getDisplayNameFromSession(session ?? null);
  const driverSuffix =
    (driverDisplayName?.trim() || roleDisplayLabel?.trim() || sessionDisplayName) || "";
  const roleBadgeText = session?.user
    ? isManager
      ? formatRoleBadge("Manager", sessionDisplayName)
      : formatRoleBadge("Driver", driverSuffix)
    : null;
  const isManagerBadge = isManager;

  return (
    <header className="mb-6 flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:flex-wrap">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {backHref != null ? (
            <Link
              href={backHref}
              className="flex shrink-0 rounded-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              aria-label={backLabel}
              title={backLabel}
            >
              <span className="flex items-center justify-center min-w-10 min-h-10 w-10 h-10 sm:min-w-12 sm:min-h-12 sm:w-12 sm:h-12">
                <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.25} />
              </span>
            </Link>
          ) : (
            <span className="w-10 h-10 sm:w-12 sm:h-12 shrink-0" aria-hidden />
          )}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {icon != null && (
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 dark:bg-slate-600 flex items-center justify-center text-white dark:text-slate-200 shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-base sm:text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 truncate">
                  {title}
                </h1>
                {roleBadgeText && (
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 max-w-[min(280px,55vw)] truncate ${
                      isManagerBadge
                        ? "text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-200"
                        : "text-[11px] font-semibold tracking-tight bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                    }`}
                    title={roleBadgeText}
                  >
                    {roleBadgeText}
                  </span>
                )}
              </div>
              {subtitle != null && (
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>

        {actions != null && (
          <div className="flex min-w-0 w-full shrink-0 flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
