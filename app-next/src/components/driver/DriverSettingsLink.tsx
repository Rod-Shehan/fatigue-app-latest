"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

/** Gear link to full settings page (driver home, weeks list). */
export function DriverSettingsLink({
  returnHref,
  className,
}: {
  returnHref?: string;
  className?: string;
}) {
  const href =
    returnHref && returnHref !== "/driver"
      ? `/driver/settings?from=${encodeURIComponent(returnHref)}`
      : "/driver/settings";

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
        "border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900",
        "text-slate-700 dark:text-slate-200",
        "hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
        className
      )}
      aria-label="Settings"
      title="Settings"
    >
      <Settings className="h-7 w-7" strokeWidth={2} aria-hidden />
    </Link>
  );
}
