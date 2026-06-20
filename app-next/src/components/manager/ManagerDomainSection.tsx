"use client";

import type { ReactNode } from "react";
import { Compass, FileEdit, Scale } from "lucide-react";
import { SectionBoundaryInfo } from "@/components/manager/SectionBoundaryInfo";

const STYLES = {
  risk: {
    border: "border-2 border-violet-300/90 dark:border-violet-600/70",
    ring: "ring-1 ring-violet-200/60 dark:ring-violet-500/25",
    headerBg:
      "bg-gradient-to-br from-violet-100 via-violet-50/90 to-white dark:from-violet-950/80 dark:via-violet-950/40 dark:to-slate-950",
    bodyBg: "bg-violet-50/40 dark:bg-violet-950/25",
    iconWrap: "bg-violet-600 text-white dark:bg-violet-500",
    boundaryTrigger:
      "text-violet-800/80 hover:text-violet-950 dark:text-violet-300/90 dark:hover:text-violet-100 focus-visible:ring-violet-500",
    Icon: Compass,
    eyebrow: "Prospective · coaching",
  },
  compliance: {
    border: "border-2 border-amber-300/90 dark:border-amber-600/60",
    ring: "ring-1 ring-amber-200/70 dark:ring-amber-500/20",
    headerBg:
      "bg-gradient-to-br from-amber-100 via-amber-50/90 to-stone-50 dark:from-amber-950/70 dark:via-amber-950/35 dark:to-slate-950",
    bodyBg: "bg-amber-50/35 dark:bg-amber-950/20",
    iconWrap: "bg-amber-700 text-white dark:bg-amber-600",
    boundaryTrigger:
      "text-amber-900/80 hover:text-amber-950 dark:text-amber-200/90 dark:hover:text-amber-50 focus-visible:ring-amber-500",
    Icon: Scale,
    eyebrow: "Attested · regulatory",
  },
  edit: {
    border: "border-2 border-teal-400/90 dark:border-teal-500/55",
    ring: "ring-1 ring-teal-200/80 dark:ring-teal-500/30",
    headerBg:
      "bg-gradient-to-br from-teal-100 via-slate-50 to-white dark:from-teal-950/75 dark:via-slate-900/90 dark:to-slate-950",
    bodyBg: "bg-slate-100/70 dark:bg-slate-900/50",
    iconWrap: "bg-teal-800 text-white dark:bg-teal-600",
    boundaryTrigger:
      "text-teal-900/80 hover:text-teal-950 dark:text-teal-200/90 dark:hover:text-teal-50 focus-visible:ring-teal-500",
    Icon: FileEdit,
    eyebrow: "Document control · editing",
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
      className={`mb-12 scroll-mt-24 overflow-hidden rounded-2xl shadow-md ${style.border} ${style.ring}`}
      aria-labelledby={`${id}-heading`}
    >
      <header className={`border-b border-inherit px-4 py-5 sm:px-6 ${style.headerBg}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ${style.iconWrap}`}
            aria-hidden
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {style.eyebrow}
            </p>
            <div className="mt-1 flex items-center gap-1">
              <h2
                id={`${id}-heading`}
                className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50"
              >
                {title}
              </h2>
              <SectionBoundaryInfo
                sectionTitle={title}
                body={boundary}
                triggerClassName={style.boundaryTrigger}
              />
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{subtitle}</p>
          </div>
        </div>
      </header>
      <div className={`space-y-6 p-4 sm:p-6 ${style.bodyBg}`}>{children}</div>
    </section>
  );
}
