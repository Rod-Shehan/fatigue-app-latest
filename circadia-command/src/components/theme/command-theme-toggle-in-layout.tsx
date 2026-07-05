"use client";

import { CommandThemeToggle } from "@/components/theme/command-theme-toggle";

export function CommandThemeToggleInLayout() {
  return (
    <div className="fixed top-4 right-4 z-50">
      <CommandThemeToggle className="border border-slate-300/80 bg-white/90 shadow-sm backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/90" />
    </div>
  );
}
