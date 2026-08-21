"use client";

import Link from "next/link";
import { FileText, Mail, Smartphone, UserRound } from "lucide-react";
import { DRIVER_SETTINGS_SECTIONS } from "@/lib/driver-settings-sections";
import { DRIVER_SETTINGS_ANCHOR_LINKS } from "@/lib/navigation/navigation-links";

const CARD = "rounded-xl border-2 p-3 shadow-sm ring-1 transition-colors";

const META = {
  "this-phone": {
    blurb: DRIVER_SETTINGS_SECTIONS.device.subtitle,
    icon: Smartphone,
    className:
      "border-sky-300/90 bg-sky-50/50 ring-sky-200/50 hover:border-sky-400 hover:bg-sky-100/50 dark:border-sky-600/60 dark:bg-sky-950/30 dark:ring-sky-500/20 dark:hover:bg-sky-950/50",
    iconClass: "text-sky-700 dark:text-sky-400",
  },
  "emails-workshop": {
    blurb: DRIVER_SETTINGS_SECTIONS.delivery.subtitle,
    icon: Mail,
    className:
      "border-emerald-300/90 bg-emerald-50/50 ring-emerald-200/50 hover:border-emerald-400 hover:bg-emerald-100/50 dark:border-emerald-600/55 dark:bg-emerald-950/30 dark:ring-emerald-500/20 dark:hover:bg-emerald-950/50",
    iconClass: "text-emerald-800 dark:text-emerald-400",
  },
  "your-record": {
    blurb: DRIVER_SETTINGS_SECTIONS.record.subtitle,
    icon: FileText,
    className:
      "border-amber-300/90 bg-amber-50/50 ring-amber-200/50 hover:border-amber-400 hover:bg-amber-100/50 dark:border-amber-600/50 dark:bg-amber-950/25 dark:ring-amber-500/15 dark:hover:bg-amber-950/40",
    iconClass: "text-amber-800 dark:text-amber-400",
  },
  account: {
    blurb: DRIVER_SETTINGS_SECTIONS.account.subtitle,
    icon: UserRound,
    className:
      "border-slate-300/90 bg-slate-50 ring-slate-200/70 hover:border-slate-400 hover:bg-slate-100 dark:border-slate-500/55 dark:bg-slate-900/60 dark:ring-slate-500/20 dark:hover:bg-slate-800",
    iconClass: "text-slate-700 dark:text-slate-300",
  },
} as const;

function scrollToSection(id: string, href: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.replaceState(null, "", href);
}

/** Jump cards at the top of Settings — same pattern as Enterprise domain overview. */
export function DriverSettingsOverview() {
  return (
    <nav
      className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2"
      aria-label="Settings sections"
    >
      {DRIVER_SETTINGS_ANCHOR_LINKS.map(({ id, href, title }) => {
        const meta = META[id as keyof typeof META];
        const Icon = meta.icon;
        return (
          <Link
            key={href}
            href={href}
            onClick={(e) => {
              e.preventDefault();
              scrollToSection(id, href);
            }}
            className={`${CARD} ${meta.className}`}
          >
            <div className="flex items-start gap-2.5">
              <Icon className={`h-5 w-5 shrink-0 ${meta.iconClass}`} aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {meta.blurb}
                </p>
              </div>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
