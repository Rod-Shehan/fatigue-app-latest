"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProductPwaInstall } from "@/hooks/use-product-pwa-install";

export function ProductInstallPanel({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { canPrompt, installed, ios, installLabel, promptInstall } = useProductPwaInstall();

  if (installed) return null;
  if (!canPrompt && !ios) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4",
        compact && "p-3",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
          <Download className="w-4 h-4 text-slate-700 dark:text-slate-200" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{installLabel}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {ios
              ? "On iPhone or iPad: Share → Add to Home Screen."
              : "Install this site as an app on this device."}
          </p>
          {canPrompt ? (
            <Button
              type="button"
              className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold"
              onClick={() => void promptInstall()}
            >
              {installLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
