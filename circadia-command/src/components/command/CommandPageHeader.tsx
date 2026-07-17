import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { CircadiaLogo } from "@/components/branding/CircadiaLogo";
import {
  commandBackLink,
  commandTextMuted,
  commandTextPrimary,
} from "@/components/command/command-styles";

type Props = {
  title: string;
  subtitle?: string;
  /** @deprecated Ignored — Circadia icon only for consistent headers. */
  icon?: ReactNode;
  /** Full wordmark instead of icon + title (login / triage desk). */
  brandFull?: boolean;
  backHref?: string;
  backLabel?: string;
  backText?: string;
  actions?: ReactNode;
  compact?: boolean;
};

const BRAND_LOGO_SIZE = 36;

export function CommandPageHeader({
  title,
  subtitle,
  icon: _icon,
  brandFull = false,
  backHref,
  backLabel,
  backText,
  actions,
  compact = false,
}: Props) {
  void _icon;
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        compact ? "mb-4" : "mb-6"
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {brandFull ? (
          <div className="min-w-0">
            <CircadiaLogo variant="full" href={null} priority />
            {subtitle != null && (
              <p className={cn("mt-1 truncate text-sm", commandTextMuted)}>{subtitle}</p>
            )}
          </div>
        ) : (
          <>
            <CircadiaLogo variant="icon" size={BRAND_LOGO_SIZE} className="shrink-0" />
            {backHref != null ? (
              <Link
                href={backHref}
                className={commandBackLink}
                aria-label={backLabel ?? "Back"}
                title={backLabel ?? "Back"}
              >
                <span className="flex h-10 w-10 items-center justify-center">
                  <ArrowLeft className="h-5 w-5" strokeWidth={2.25} aria-hidden />
                </span>
                {backText ? (
                  <span className="-ml-1 pr-2 text-sm font-medium whitespace-nowrap">{backText}</span>
                ) : null}
              </Link>
            ) : null}
            <div className="min-w-0">
              <h1 className={cn("truncate text-lg font-bold tracking-tight md:text-xl", commandTextPrimary)}>
                {title}
              </h1>
              {subtitle != null && (
                <p className={cn("mt-0.5 truncate text-sm", commandTextMuted)}>{subtitle}</p>
              )}
            </div>
          </>
        )}
      </div>
      {actions != null && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 pr-12 sm:pr-0">{actions}</div>
      )}
    </header>
  );
}
