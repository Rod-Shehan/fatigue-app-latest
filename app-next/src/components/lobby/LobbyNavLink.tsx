"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home } from "lucide-react";
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
          "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
          className
        )}
        aria-label={LOBBY_NAV_LABEL}
        title={LOBBY_NAV_LABEL}
        aria-current={active ? "page" : undefined}
      >
        <Home className="h-5 w-5" aria-hidden />
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
    >
      <Home className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
      {LOBBY_NAV_LABEL}
    </Link>
  );
}
