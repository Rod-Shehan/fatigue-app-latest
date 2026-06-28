import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
};

export function CommandPageHeader({ title, subtitle, icon, actions, compact = false }: Props) {
  return (
    <header className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", compact ? "mb-4" : "mb-6")}>
      <div className="flex min-w-0 items-start gap-3">
        {icon != null && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white shadow-sm ring-1 ring-slate-700/80">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-tight text-slate-100 md:text-xl">{title}</h1>
          {subtitle != null && (
            <p className="mt-0.5 truncate text-sm text-slate-400">{subtitle}</p>
          )}
        </div>
      </div>
      {actions != null && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
