"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DeviceSetupDialog } from "@/components/pwa/DeviceSetupDialog";
import { EwdInstallRecipes, useEwdNativeInstall } from "@/components/pwa/EwdInstallRecipes";
import { isDeviceSetupComplete, isStandaloneDisplay, isiOS } from "@/lib/device-setup";
import {
  EWD_INSTALL_ANDROID_NATIVE_BUTTON,
  EWD_INSTALL_HOW_TO_BUTTON,
  EWD_INSTALL_PROMPT_TITLE,
  EWD_INSTALL_PROMPT_TITLE_IOS,
  EWD_INSTALL_SETUP_BUTTON,
} from "@/lib/ewd-install";

export function InstallAndSetupCard({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const setupComplete = useMemo(() => isDeviceSetupComplete(), []);
  const { canNativeInstall, install } = useEwdNativeInstall();

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const standalone = isStandaloneDisplay();
  if (setupComplete && standalone) return null;

  const ios = isiOS();
  const title = ios && !standalone ? EWD_INSTALL_PROMPT_TITLE_IOS : EWD_INSTALL_PROMPT_TITLE;
  const setupLabel = setupComplete ? EWD_INSTALL_HOW_TO_BUTTON : EWD_INSTALL_SETUP_BUTTON;

  return (
    <>
      <div
        className={cn(
          "rounded-2xl border-2 border-teal-500 bg-teal-50/90 p-4 space-y-3 dark:border-teal-600 dark:bg-teal-950/40",
          className
        )}
      >
        <p className="text-base font-bold text-teal-950 dark:text-teal-50">{title}</p>
        {standalone ? (
          <p className="text-sm leading-relaxed text-teal-900 dark:text-teal-100">
            Installed fullscreen. Finish storage protection if you have not yet.
          </p>
        ) : (
          <EwdInstallRecipes />
        )}
        <div className="flex flex-col gap-2">
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
            variant={canNativeInstall ? "outline" : "default"}
            className={cn(
              "w-full min-h-[44px] touch-manipulation font-semibold",
              !canNativeInstall && "bg-teal-700 hover:bg-teal-800 text-white"
            )}
            onClick={() => setOpen(true)}
          >
            {setupLabel}
          </Button>
        </div>
      </div>

      <DeviceSetupDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
