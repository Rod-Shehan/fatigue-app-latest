"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, HardDrive, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EwdInstallRecipes } from "@/components/pwa/EwdInstallRecipes";
import { cn } from "@/lib/utils";
import {
  isDeviceSetupComplete,
  isStandaloneDisplay,
  requestPersistentStorage,
  setDeviceSetupComplete,
} from "@/lib/device-setup";
import { writeDeviceSnapshot } from "@/lib/device-backup";
import { EWD_INSTALL_SETUP_BUTTON } from "@/lib/ewd-install";

export function DeviceSetupDialog({
  open,
  onOpenChange,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}) {
  const alreadySetup = useMemo(() => isDeviceSetupComplete(), []);
  const [agree, setAgree] = useState(false);
  const [working, setWorking] = useState(false);
  const [persistResult, setPersistResult] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setAgree(false);
      setWorking(false);
      setPersistResult(null);
    }
  }, [open]);

  const inStandalone = isStandaloneDisplay();

  const completeSetup = async () => {
    if (alreadySetup) {
      onOpenChange(false);
      onCompleted?.();
      return;
    }
    if (!agree) return;
    setWorking(true);
    const res = await requestPersistentStorage();
    if (!res.supported) setPersistResult("Storage protection: not supported on this browser.");
    else if (res.persisted) setPersistResult("Storage protection: enabled.");
    else setPersistResult("Storage protection: requested (not guaranteed).");
    setDeviceSetupComplete();
    await writeDeviceSnapshot({ force: true }).catch(() => {});
    setWorking(false);
    onCompleted?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[min(90dvh,40rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set up this phone for offline use</DialogTitle>
          <DialogDescription>
            Circadia24 stores your diary on this device so you can log and produce records with no mobile coverage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!inStandalone ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Install to the home screen</p>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                iPhone never shows a browser install banner. Use the iPhone steps below. Android steps stay next to
                them for mixed fleets.
              </p>
              <EwdInstallRecipes />
            </div>
          ) : (
            <p className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100">
              Installed fullscreen: opens without browser bars — best for dashboard mounting.
            </p>
          )}

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

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={working}>
              Not now
            </Button>
            <Button
              type="button"
              className={cn("bg-teal-700 hover:bg-teal-800 text-white", alreadySetup && "bg-slate-900 hover:bg-slate-800")}
              disabled={working || (!alreadySetup && !agree)}
              onClick={() => void completeSetup()}
            >
              {alreadySetup ? "Close" : working ? "Setting up…" : EWD_INSTALL_SETUP_BUTTON}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
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
