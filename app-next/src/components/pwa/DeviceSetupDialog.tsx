"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, HardDrive, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  isDeviceSetupComplete,
  isStandaloneDisplay,
  requestPersistentStorage,
  setDeviceSetupComplete,
} from "@/lib/device-setup";
import { writeDeviceSnapshot } from "@/lib/device-backup";
import { DEVICE_SETUP_BUTTON_LABEL } from "@/lib/product-copy";
import { useProductPwaInstall } from "@/hooks/use-product-pwa-install";

export function DeviceSetupDialog({
  open,
  onOpenChange,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}) {
  const [alreadySetup, setAlreadySetup] = useState(false);
  const [agree, setAgree] = useState(false);
  const [working, setWorking] = useState(false);
  const [persistResult, setPersistResult] = useState<string | null>(null);
  const { canPrompt, installed, ios, installLabel, iconSrc, promptInstall } = useProductPwaInstall();

  useEffect(() => {
    if (!open) {
      setAgree(false);
      setWorking(false);
      setPersistResult(null);
      return;
    }
    setAlreadySetup(isDeviceSetupComplete());
  }, [open]);

  const persistIfNeeded = async () => {
    if (alreadySetup) return true;
    if (!agree) return false;
    const res = await requestPersistentStorage();
    if (!res.supported) setPersistResult("Storage protection: not supported on this browser.");
    else if (res.persisted) setPersistResult("Storage protection: enabled.");
    else setPersistResult("Storage protection: requested (not guaranteed).");
    setDeviceSetupComplete();
    await writeDeviceSnapshot({ force: true }).catch(() => {});
    setAlreadySetup(true);
    return true;
  };

  const finish = () => {
    onCompleted?.();
    onOpenChange(false);
  };

  const completeSetup = async () => {
    if (alreadySetup) {
      finish();
      return;
    }
    setWorking(true);
    const ok = await persistIfNeeded();
    setWorking(false);
    if (ok) finish();
  };

  const installApp = async () => {
    setWorking(true);
    const ok = await persistIfNeeded();
    if (!ok) {
      setWorking(false);
      return;
    }
    if (canPrompt) {
      await promptInstall();
    }
    setWorking(false);
    onCompleted?.();
    if (isStandaloneDisplay()) onOpenChange(false);
  };

  const installHint = installed
    ? "Installed: opens without browser bars — best for dashboard mounting."
    : ios
      ? "In Safari: Share → Add to Home Screen. The Circadia icon should appear on this phone."
      : canPrompt
        ? `Tap ${installLabel}. The browser will ask you to add this app.`
        : "If Install does not appear, use the browser menu → Install app (or Add to Home Screen).";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set up this phone for offline use</DialogTitle>
          <DialogDescription>
            Circadia24 stores your diary on this device so you can log and produce records with no mobile coverage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/30 p-3 space-y-2">
            <Row
              icon={<HardDrive className="w-4 h-4" />}
              title="On-device storage"
              desc="Your current and recent weeks are stored on this phone (IndexedDB)."
            />
            <Row
              icon={<Shield className="w-4 h-4" />}
              title="Storage protection"
              desc="We’ll ask the browser to keep your offline data from being evicted under storage pressure."
            />
            <Row
              icon={
                <img src={iconSrc} alt="" width={20} height={20} className="w-5 h-5 rounded-sm bg-[#0A1118]" />
              }
              title={installLabel}
              desc={installHint}
            />
          </div>

          {!alreadySetup && (
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                I understand this app will save my work diary on this device for offline use. Clearing browser/app data can
                remove on-device records.
              </span>
            </label>
          )}

          {persistResult && (
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600" aria-hidden />
              <span>{persistResult}</span>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={working}>
              Not now
            </Button>
            {alreadySetup && !canPrompt ? (
              <Button
                type="button"
                className="bg-slate-900 hover:bg-slate-800 text-white"
                disabled={working}
                onClick={() => finish()}
              >
                Close
              </Button>
            ) : null}
            {!alreadySetup ? (
              <Button
                type="button"
                variant={canPrompt ? "outline" : "default"}
                className={cn(!canPrompt && "bg-teal-700 hover:bg-teal-800 text-white")}
                disabled={working || !agree}
                onClick={() => void completeSetup()}
              >
                {working && !canPrompt ? "Setting up…" : DEVICE_SETUP_BUTTON_LABEL}
              </Button>
            ) : null}
            {canPrompt ? (
              <Button
                type="button"
                className="bg-teal-700 hover:bg-teal-800 text-white"
                disabled={working || (!alreadySetup && !agree)}
                onClick={() => void installApp()}
              >
                {working ? "Installing…" : installLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
