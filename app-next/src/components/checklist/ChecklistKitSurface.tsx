"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Checklist surface — uses global `--ck-*` tokens that follow `html.dark`. */
export function ChecklistKitSurface({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("checklist-kit", className)}>{children}</div>;
}
