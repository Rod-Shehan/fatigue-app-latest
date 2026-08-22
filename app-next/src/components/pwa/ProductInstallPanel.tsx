"use client";

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
  const { canPrompt, installed, ios, installLabel, iconSrc, promptInstall } = useProductPwaInstall();

  if (installed) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4",
        compact && "p-3",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <img
          src={iconSrc}
          alt=""
          width={44}
          height={44}
          className="w-11 h-11 rounded-xl shrink-0 bg-[#0A1118]"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{installLabel}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {ios
              ? "In Safari: Share → Add to Home Screen. The Circadia icon should appear on this phone."
              : canPrompt
                ? "Install this site as an app. The Circadia icon is added to this device."
                : "Use the browser menu → Install app or Add to Home Screen. The Circadia icon is added to this device."}
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
