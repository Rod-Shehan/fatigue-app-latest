"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircadiaLogo } from "@/components/branding/CircadiaLogo";
import { LOBBY_NAV_LABEL } from "@/lib/lobby-url";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Icon-only control for tight mobile driver headers. */
  iconOnly?: boolean;
};

export function LobbyNavLink({ className, iconOnly = false }: Props) {
  const pathname = usePathname();
  const active = pathname === "/";

  if (iconOnly) {
    return (
      <Link
        href="/"
        className={cn(
          "inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl",
          "border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900",
          "hover:opacity-90 transition-opacity",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
          className
        )}
        aria-label={LOBBY_NAV_LABEL}
        title={LOBBY_NAV_LABEL}
        aria-current={active ? "page" : undefined}
      >
        <CircadiaLogo variant="icon" size={28} href={null} />
      </Link>
    );
  }

  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-teal-700 text-white shadow-sm dark:bg-teal-600"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
        className
      )}
      aria-current={active ? "page" : undefined}
      title={LOBBY_NAV_LABEL}
    >
      <CircadiaLogo variant="icon" size={20} href={null} className="rounded-md" />
      {LOBBY_NAV_LABEL}
    </Link>
  );
}
