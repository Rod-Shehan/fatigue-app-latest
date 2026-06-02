"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { driverListRow } from "@/components/driver/driver-ui-classes";

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
        driverListRow,
        "cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {icon && <span className="shrink-0 text-slate-500 dark:text-slate-400">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-slate-900 dark:text-slate-100">{title}</span>
        {description && (
          <span className="block text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</span>
        )}
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="h-6 w-6 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-900"
      />
    </label>
  );
}
