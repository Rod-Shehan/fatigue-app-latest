"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

export function ThemeToggleInLayout() {
  const pathname = usePathname();
  // Driver settings page owns display options; avoid a second theme control.
  if (pathname?.startsWith("/driver")) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <ThemeToggle />
    </div>
  );
}
