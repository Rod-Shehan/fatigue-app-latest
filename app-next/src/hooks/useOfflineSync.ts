"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { runSync, getPendingCount } from "@/lib/offline-api";

/** Runs sync when online; exposes online status and pending count for UI. */
export function useOfflineSync() {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const probeOnline = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/ping", { method: "HEAD", cache: "no-store" });
      return res.ok;
    } catch {
      return false;
    }
  };

  const doSync = async () => {
    const result = await runSync();
    if (result.replacedTempId) {
      const { tempId, realId } = result.replacedTempId;
      if (typeof window !== "undefined" && window.location.pathname === `/sheets/${tempId}`) {
        window.history.replaceState(null, "", `/sheets/${realId}`);
        queryClient.invalidateQueries({ queryKey: ["sheet", realId] });
        queryClient.invalidateQueries({ queryKey: ["sheets"] });
      }
    }
    if (result.synced > 0) {
      queryClient.invalidateQueries({ queryKey: ["sheets"] });
      queryClient.invalidateQueries({ queryKey: ["sheet"] });
    }
    const count = await getPendingCount();
    setPendingCount(count);
  };

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      doSync().catch(() => {});
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    getPendingCount().then(setPendingCount).catch(() => setPendingCount(0));
    doSync().catch(() => {});

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      getPendingCount().then(setPendingCount).catch(() => setPendingCount(0));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Some devices/browsers report navigator.onLine incorrectly; confirm with a lightweight probe.
  useEffect(() => {
    const interval = setInterval(() => {
      const navOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      if (navOnline) {
        setOnline(true);
        doSync().catch(() => {});
        return;
      }
      // If browser claims offline, verify with a HEAD request.
      probeOnline()
        .then((ok) => {
          setOnline(ok);
          if (ok) doSync().catch(() => {});
        })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return { online, pendingCount, runSync: doSync };
}
