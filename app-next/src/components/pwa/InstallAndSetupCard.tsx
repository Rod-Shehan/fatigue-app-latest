"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DeviceSetupDialog } from "@/components/pwa/DeviceSetupDialog";
import { isDeviceSetupComplete, isStandaloneDisplay } from "@/lib/device-setup";
import { DEVICE_INSTALL_HELP_LABEL, DEVICE_SETUP_BUTTON_LABEL } from "@/lib/product-copy";
import { useProductPwaInstall } from "@/hooks/use-product-pwa-install";

export function InstallAndSetupCard({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const { canPrompt, installed, installLabel, iconSrc, promptInstall } = useProductPwaInstall();

  useEffect(() => {
    setMounted(true);
    setSetupComplete(isDeviceSetupComplete());
  }, []);

  if (!mounted) return null;
  if (setupComplete && (installed || isStandaloneDisplay())) return null;

  const label = canPrompt
    ? installLabel
    : setupComplete
      ? DEVICE_INSTALL_HELP_LABEL
      : DEVICE_SETUP_BUTTON_LABEL;

  const onClick = () => {
    if (setupComplete && canPrompt) {
      void promptInstall();
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <div className={cn(className)}>
        <Button
          type="button"
          className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold gap-3"
          onClick={onClick}
        >
          <img src={iconSrc} alt="" width={28} height={28} className="w-7 h-7 rounded-md bg-[#0A1118]" />
          {label}
        </Button>
      </div>

      <DeviceSetupDialog
        open={open}
        onOpenChange={setOpen}
        onCompleted={() => {
          setSetupComplete(isDeviceSetupComplete());
        }}
      />
    </>
  );
}
