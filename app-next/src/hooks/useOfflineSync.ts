"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { runSync, getPendingCount } from "@/lib/offline-api";

const ACTIVE_SYNC_MS = 10_000;
const IDLE_PROBE_MS = 60_000;

/** Runs sync when online and writes are pending; exposes online status and pending count for UI. */
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
    return count;
  };

  const refreshPendingAndMaybeSync = async () => {
    const count = await getPendingCount();
    setPendingCount(count);
    if (count === 0) return count;
    const navOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (navOnline) {
      setOnline(true);
      await doSync().catch(() => {});
      return count;
    }
    const ok = await probeOnline();
    setOnline(ok);
    if (ok) await doSync().catch(() => {});
    return count;
  };

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      refreshPendingAndMaybeSync().catch(() => {});
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    getPendingCount()
      .then((count) => {
        setPendingCount(count);
        if (count > 0) doSync().catch(() => {});
      })
      .catch(() => setPendingCount(0));

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

  // Probe/sync only when there are pending writes; otherwise recover from false offline less often.
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const schedule = (delayMs: number) => {
      timeout = setTimeout(() => {
        void tick();
      }, delayMs);
    };

    const tick = async () => {
      try {
        const count = await getPendingCount();
        setPendingCount(count);
        if (count > 0) {
          await refreshPendingAndMaybeSync();
          schedule(ACTIVE_SYNC_MS);
          return;
        }
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const ok = await probeOnline();
          setOnline(ok);
        }
        schedule(IDLE_PROBE_MS);
      } catch {
        schedule(IDLE_PROBE_MS);
      }
    };

    schedule(ACTIVE_SYNC_MS);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  return { online, pendingCount, runSync: doSync };
}
