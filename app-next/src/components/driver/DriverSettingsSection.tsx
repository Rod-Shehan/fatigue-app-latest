import type { ReactNode } from "react";
import { FileText, Mail, Smartphone, UserRound } from "lucide-react";

const STYLES = {
  device: {
    border: "border-2 border-sky-300/90 dark:border-sky-600/60",
    ring: "ring-1 ring-sky-200/70 dark:ring-sky-500/20",
    headerBg:
      "bg-gradient-to-br from-sky-100 via-sky-50/90 to-white dark:from-sky-950/80 dark:via-sky-950/40 dark:to-slate-950",
    bodyBg: "bg-sky-50/40 dark:bg-sky-950/20",
    iconWrap: "bg-sky-700 text-white dark:bg-sky-600",
    Icon: Smartphone,
  },
  delivery: {
    border: "border-2 border-emerald-300/90 dark:border-emerald-600/55",
    ring: "ring-1 ring-emerald-200/70 dark:ring-emerald-500/20",
    headerBg:
      "bg-gradient-to-br from-emerald-100 via-emerald-50/90 to-white dark:from-emerald-950/75 dark:via-emerald-950/35 dark:to-slate-950",
    bodyBg: "bg-emerald-50/35 dark:bg-emerald-950/20",
    iconWrap: "bg-emerald-700 text-white dark:bg-emerald-600",
    Icon: Mail,
  },
  record: {
    border: "border-2 border-amber-300/90 dark:border-amber-600/55",
    ring: "ring-1 ring-amber-200/70 dark:ring-amber-500/20",
    headerBg:
      "bg-gradient-to-br from-amber-100 via-amber-50/90 to-stone-50 dark:from-amber-950/70 dark:via-amber-950/35 dark:to-slate-950",
    bodyBg: "bg-amber-50/35 dark:bg-amber-950/20",
    iconWrap: "bg-amber-700 text-white dark:bg-amber-600",
    Icon: FileText,
  },
  account: {
    border: "border-2 border-slate-300/90 dark:border-slate-500/60",
    ring: "ring-1 ring-slate-200/80 dark:ring-slate-500/25",
    headerBg:
      "bg-gradient-to-br from-slate-100 via-slate-50 to-white dark:from-slate-800 dark:via-slate-900 dark:to-slate-950",
    bodyBg: "bg-slate-100/70 dark:bg-slate-900/50",
    iconWrap: "bg-slate-800 text-white dark:bg-slate-600",
    Icon: UserRound,
  },
} as const;

/** Framed settings domain — same layout idea as Enterprise ManagerDomainSection, phone-sized. */
export function DriverSettingsSection({
  id,
  variant,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  id: string;
  variant: keyof typeof STYLES;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const style = STYLES[variant];
  const Icon = style.Icon;

  return (
    <section
      id={id}
      className={`mb-6 scroll-mt-20 overflow-hidden rounded-2xl shadow-md ${style.border} ${style.ring}`}
      aria-labelledby={`${id}-heading`}
    >
      <header className={`border-b border-inherit px-4 py-4 ${style.headerBg}`}>
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${style.iconWrap}`}
            aria-hidden
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {eyebrow}
            </p>
            <h2
              id={`${id}-heading`}
              className="mt-1 text-base font-bold tracking-tight text-slate-900 dark:text-slate-50"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{subtitle}</p>
          </div>
        </div>
      </header>
      <div className={`space-y-4 p-3 sm:p-4 ${style.bodyBg}`}>{children}</div>
    </section>
  );
}
