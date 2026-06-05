"use client";

import { useCallback, useEffect, useState } from "react";
import { HardDrive, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { driverSectionLabel } from "@/components/driver/driver-ui-classes";
import {
  formatBackupTime,
  getDeviceBackupStatus,
  restoreDeviceBackup,
  writeDeviceSnapshot,
  getLatestDeviceBackup,
} from "@/lib/device-backup";
import { useQueryClient } from "@tanstack/react-query";

export function DriverDeviceBackupPanel({ driverEmail }: { driverEmail?: string | null }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<{
    snapshotCount: number;
    lastBackupAt: number | null;
    weekCount: number;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const s = await getDeviceBackupStatus(driverEmail);
    setStatus(s);
  }, [driverEmail]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const backupNow = async () => {
    setPending(true);
    setMessage(null);
    const res = await writeDeviceSnapshot({ driverEmail, force: true });
    await refresh();
    setPending(false);
    setMessage(res.ok ? "Backup saved on this device." : "Nothing to back up yet — log a week first.");
  };

  const restoreNow = async () => {
    if (!window.confirm("Restore your records from the latest on-device backup? This replaces cached weeks on this phone.")) {
      return;
    }
    setPending(true);
    setMessage(null);
    const latest = await getLatestDeviceBackup(driverEmail);
    if (!latest) {
      setPending(false);
      setMessage("No backup found on this device.");
      return;
    }
    const { weekCount } = await restoreDeviceBackup(latest);
    await refresh();
    void queryClient.invalidateQueries({ queryKey: ["sheets"] });
    void queryClient.invalidateQueries({ queryKey: ["sheet"] });
    setPending(false);
    setMessage(`Restored ${weekCount} week${weekCount !== 1 ? "s" : ""} from backup.`);
  };

  return (
    <section>
      <h2 className={driverSectionLabel}>On-device backup</h2>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5 text-slate-700 dark:text-slate-200" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-300 space-y-1">
            <p>
              <span className="font-semibold text-slate-900 dark:text-slate-100">Last backup: </span>
              {status ? formatBackupTime(status.lastBackupAt) : "…"}
            </p>
            <p>
              <span className="font-semibold text-slate-900 dark:text-slate-100">Snapshots: </span>
              {status?.snapshotCount ?? "…"} (keeps last 5)
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Automatic backups run when you save weeks. PDFs are not stored — produce only when needed.
            </p>
          </div>
        </div>

        {message && (
          <p className="text-sm text-teal-800 dark:text-teal-200 font-medium" role="status">
            {message}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full font-semibold gap-2"
            disabled={pending}
            onClick={() => void backupNow()}
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
            Backup now
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full font-semibold gap-2"
            disabled={pending}
            onClick={() => void restoreNow()}
          >
            <RotateCcw className="w-4 h-4" />
            Restore from backup
          </Button>
        </div>
      </div>
    </section>
  );
}
