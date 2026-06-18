"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { driverIconBtnBordered } from "@/components/driver/driver-ui-classes";

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
      className={cn(driverIconBtnBordered, "focus-visible:ring-emerald-500", className)}
      aria-label="Settings"
      title="Settings"
    >
      <Settings className="h-7 w-7" strokeWidth={2} aria-hidden />
    </Link>
  );
}
