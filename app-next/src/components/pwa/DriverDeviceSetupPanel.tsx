"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeviceSetupDialog } from "@/components/pwa/DeviceSetupDialog";
import { EwdInstallRecipes, useEwdNativeInstall } from "@/components/pwa/EwdInstallRecipes";
import { driverSectionLabel } from "@/components/driver/driver-ui-classes";
import { isDeviceSetupComplete, isStandaloneDisplay } from "@/lib/device-setup";
import {
  EWD_INSTALL_ANDROID_NATIVE_BUTTON,
  EWD_INSTALL_HOW_TO_BUTTON,
  EWD_INSTALL_SETUP_BUTTON,
} from "@/lib/ewd-install";

export function DriverDeviceSetupPanel({ hideHeading = false }: { hideHeading?: boolean }) {
  const [open, setOpen] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const { canNativeInstall, install } = useEwdNativeInstall();

  useEffect(() => {
    setSetupComplete(isDeviceSetupComplete());
    setStandalone(isStandaloneDisplay());
  }, []);

  // Hide once complete and installed; keep visible otherwise as a support affordance.
  if (setupComplete && standalone) return null;

  const setupLabel = setupComplete ? EWD_INSTALL_HOW_TO_BUTTON : EWD_INSTALL_SETUP_BUTTON;

  return (
    <section>
      {hideHeading ? null : <h2 className={driverSectionLabel}>Device</h2>}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-slate-700 dark:text-slate-200" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Offline setup</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5">
              Recommended for WA remote areas: install to your home screen and enable storage protection. iPhone
              and Android steps are both shown — this phone is marked.
            </p>
          </div>
        </div>
        {standalone ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Installed fullscreen. Finish storage protection if you have not yet.
          </p>
        ) : (
          <EwdInstallRecipes />
        )}
        {canNativeInstall ? (
          <Button
            type="button"
            className="w-full min-h-[44px] touch-manipulation bg-teal-700 hover:bg-teal-800 text-white font-semibold"
            onClick={() => void install()}
          >
            {EWD_INSTALL_ANDROID_NATIVE_BUTTON}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="w-full min-h-[44px] touch-manipulation font-semibold"
          onClick={() => setOpen(true)}
        >
          {setupLabel}
        </Button>
      </div>

      <DeviceSetupDialog
        open={open}
        onOpenChange={setOpen}
        onCompleted={() => {
          setSetupComplete(isDeviceSetupComplete());
          setStandalone(isStandaloneDisplay());
        }}
      />
    </section>
  );
}
