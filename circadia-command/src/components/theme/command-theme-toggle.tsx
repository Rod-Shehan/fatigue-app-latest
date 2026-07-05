"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/theme-provider";

export function CommandThemeToggle({ className }: { className?: string }) {
  const { resolved, setTheme } = useTheme();

  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
        className
      )}
      onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
      title={resolved === "dark" ? "Switch to day mode" : "Switch to dark mode"}
      aria-label={resolved === "dark" ? "Switch to day mode" : "Switch to dark mode"}
    >
      {resolved === "dark" ? (
        <Sun className="h-5 w-5" strokeWidth={2} aria-hidden />
      ) : (
        <Moon className="h-5 w-5" strokeWidth={2} aria-hidden />
      )}
    </button>
  );
}
