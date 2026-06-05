"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  registerDeviceBackupOnHidden,
  tryAutoRestoreDeviceBackup,
} from "@/lib/device-backup";

/** Auto-restore from snapshot when live cache is empty; register hidden backup. */
export function useDeviceBackup(driverEmail?: string | null) {
  const queryClient = useQueryClient();
  const [restoreNotice, setRestoreNotice] = useState<{ weekCount: number } | null>(null);

  useEffect(() => {
    if (!driverEmail) return;
    let cancelled = false;
    void tryAutoRestoreDeviceBackup(driverEmail).then((result) => {
      if (cancelled || !result?.restored) return;
      setRestoreNotice({ weekCount: result.weekCount });
      void queryClient.invalidateQueries({ queryKey: ["sheets"] });
      void queryClient.invalidateQueries({ queryKey: ["sheet"] });
    });
    return () => {
      cancelled = true;
    };
  }, [driverEmail, queryClient]);

  useEffect(() => {
    if (!driverEmail) return;
    return registerDeviceBackupOnHidden(driverEmail);
  }, [driverEmail]);

  return { restoreNotice, dismissRestoreNotice: () => setRestoreNotice(null) };
}
