"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { commandNavLinkActive, commandNavLinkGhost } from "@/components/command/command-styles";
import { cn } from "@/lib/utils";

export function CommandNavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  if (active) {
    return (
      <span className={commandNavLinkActive} aria-current="page">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={commandNavLinkGhost}>
      {children}
    </Link>
  );
}

export function CommandMenuNavLink({
  href,
  active,
  onClick,
  children,
}: {
  href: string;
  active: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  const className = cn(
    "flex items-center gap-2 px-3 py-2 text-sm",
    active
      ? "bg-teal-700 font-medium text-white"
      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
  );
  if (active) {
    return (
      <span className={className} aria-current="page" role="menuitem">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} role="menuitem" className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
