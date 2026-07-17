"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DeviceSetupDialog } from "@/components/pwa/DeviceSetupDialog";
import { isDeviceSetupComplete, isStandaloneDisplay } from "@/lib/device-setup";

export function InstallAndSetupCard({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const setupComplete = useMemo(() => isDeviceSetupComplete(), []);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  if (setupComplete && isStandaloneDisplay()) return null;

  return (
    <>
      <div className={cn(className)}>
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
