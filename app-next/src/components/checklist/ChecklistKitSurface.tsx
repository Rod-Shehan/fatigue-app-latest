"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Scopes Circadia24 checklist brand tokens (`.checklist-kit` in globals.css). */
export function ChecklistKitSurface({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("checklist-kit", className)}>{children}</div>;
}
