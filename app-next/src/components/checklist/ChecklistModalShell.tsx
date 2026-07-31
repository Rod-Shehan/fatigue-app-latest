"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChecklistKitSurface } from "./ChecklistKitSurface";

/**
 * Mobile-first near-full-height sheet for checklist forms (Phase 1 shell).
 */
export function ChecklistModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="checklist-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 border-0 bg-black/60 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <ChecklistKitSurface
        className={cn(
          "relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-ck-border shadow-2xl",
          "max-h-[min(96dvh,900px)]",
          className
        )}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-ck-border bg-ck-midnight px-4 py-3">
          <div className="min-w-0">
            <h2 id="checklist-modal-title" className="text-lg font-bold text-white">
              {title}
            </h2>
            {subtitle ? <p className="mt-0.5 text-sm text-ck-steel">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-ck-border text-ck-steel hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer ? (
          <footer className="sticky bottom-0 border-t border-ck-border bg-ck-slate px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        ) : null}
      </ChecklistKitSurface>
    </div>
  );
}
