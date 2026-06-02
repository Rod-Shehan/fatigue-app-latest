"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsToggleRow({
  icon,
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  id,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3.5 min-h-[52px] cursor-pointer",
        "hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/60 dark:active:bg-slate-800",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {icon && <span className="shrink-0 text-slate-500 dark:text-slate-400">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{title}</span>
        {description && (
          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</span>
        )}
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="h-5 w-5 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-900"
      />
    </label>
  );
}
