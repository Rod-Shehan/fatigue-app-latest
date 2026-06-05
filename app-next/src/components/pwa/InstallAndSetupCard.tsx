"use client";

import { useEffect, useMemo, useState } from "react";
import { Smartphone, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DeviceSetupDialog } from "@/components/pwa/DeviceSetupDialog";
import { isDeviceSetupComplete, isStandaloneDisplay, isiOS } from "@/lib/device-setup";

export function InstallAndSetupCard({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const setupComplete = useMemo(() => isDeviceSetupComplete(), []);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const standalone = isStandaloneDisplay();
  const ios = isiOS();

  if (setupComplete && standalone) return null;

  const title = setupComplete ? "Install recommended" : "Set up this phone for remote areas";
  const desc = setupComplete
    ? ios
      ? "Add to Home Screen so the app opens reliably with low coverage."
      : "Install to your home screen for faster, more reliable opens."
    : "Enable on-device storage protection and learn how to add to your home screen.";

  return (
    <>
      <div
        className={cn(
          "rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50/80 dark:bg-teal-950/30 p-4 space-y-3",
          className
        )}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/80 dark:bg-slate-900 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-800 dark:text-teal-200">
            {setupComplete ? <Smartphone className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-teal-950 dark:text-teal-100">{title}</p>
            <p className="text-sm text-teal-900/80 dark:text-teal-200/90 leading-relaxed mt-0.5">{desc}</p>
          </div>
        </div>
        <Button
          type="button"
          className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold"
          onClick={() => setOpen(true)}
        >
          {setupComplete ? "How to install" : "Set up this device"}
        </Button>
      </div>

      <DeviceSetupDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

