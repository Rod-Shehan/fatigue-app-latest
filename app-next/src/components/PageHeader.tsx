"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSession } from "next-auth/react";

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
  /** When logged in as driver, shown in the role badge instead of "Driver" (e.g. roster name). */
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
  roleDisplayLabel?: string | null;
}) {
  const { data: session } = useSession();
  const role = (session?.user as unknown as { role?: string | null } | undefined)?.role ?? null;
  const roleLabel = session?.user
    ? role === "manager"
      ? "Manager"
      : (roleDisplayLabel?.trim() || "Driver")
    : null;
  const isManagerBadge = role === "manager";

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:flex-wrap mb-6">
      <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
        {backHref != null ? (
          <Link
            href={backHref}
            className="flex shrink-0 rounded-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
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
        <div className="flex items-center gap-3 min-w-0 flex-1">
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
              {roleLabel && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 max-w-[min(200px,45vw)] truncate ${
                    isManagerBadge
                      ? "text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-200"
                      : "text-[11px] font-semibold tracking-tight bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                  }`}
                  title={isManagerBadge ? "Manager view" : `${roleLabel} (driver)`}
                >
                  {roleLabel}
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
        <div className="flex flex-wrap items-center gap-2 justify-start min-w-0 w-full sm:w-auto">
          {actions}
        </div>
      )}
    </header>
  );
}
