import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsListRow({
  href,
  icon,
  title,
  description,
  external,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description?: string;
  external?: boolean;
}) {
  const className = cn(
    "flex w-full items-center gap-3 px-4 py-3.5 min-h-[52px] text-left",
    "hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/60 dark:active:bg-slate-800",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
  );

  const content = (
    <>
      <span className="shrink-0 text-slate-500 dark:text-slate-400">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{title}</span>
        {description && (
          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</span>
        )}
      </span>
      <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
    </>
  );

  if (external) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
