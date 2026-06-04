"use client";

import type { ReactNode } from "react";
import { Compass, Scale } from "lucide-react";

const STYLES = {
  risk: {
    border: "border-violet-200/90 dark:border-violet-800/60",
    headerBg: "bg-gradient-to-r from-violet-50/90 to-slate-50/80 dark:from-violet-950/40 dark:to-slate-900/80",
    iconWrap: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
    boundary: "border-violet-200/80 bg-violet-50/50 text-violet-950 dark:border-violet-800/50 dark:bg-violet-950/25 dark:text-violet-100",
    Icon: Compass,
  },
  compliance: {
    border: "border-slate-200/90 dark:border-slate-700",
    headerBg: "bg-gradient-to-r from-slate-50 to-slate-100/80 dark:from-slate-900/80 dark:to-slate-950",
    iconWrap: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
    boundary: "border-teal-200/80 bg-teal-50/40 text-teal-950 dark:border-teal-800/50 dark:bg-teal-950/20 dark:text-teal-100",
    Icon: Scale,
  },
} as const;

export function ManagerDomainSection({
  id,
  variant,
  title,
  subtitle,
  boundary,
  children,
}: {
  id: string;
  variant: keyof typeof STYLES;
  title: string;
  subtitle: string;
  boundary: string;
  children: ReactNode;
}) {
  const style = STYLES[variant];
  const Icon = style.Icon;

  return (
    <section
      id={id}
      className={`mb-10 scroll-mt-24 overflow-hidden rounded-2xl border shadow-sm ${style.border}`}
      aria-labelledby={`${id}-heading`}
    >
      <header className={`border-b px-4 py-4 sm:px-6 ${style.headerBg} border-inherit`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.iconWrap}`}
            aria-hidden
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id={`${id}-heading`}
              className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{subtitle}</p>
            <p
              className={`mt-3 rounded-lg border px-3 py-2 text-xs leading-relaxed ${style.boundary}`}
            >
              {boundary}
            </p>
          </div>
        </div>
      </header>
      <div className="space-y-6 bg-white p-4 dark:bg-slate-900 sm:p-6">{children}</div>
    </section>
  );
}
