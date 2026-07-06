"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const WAKE_LOCK_STORAGE_KEY = "command:keepScreenOn";

type WakeLockSentinel = {
  release: () => Promise<void>;
};

export function useScreenWakeLock(enabled: boolean) {
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "wakeLock" in navigator);
    try {
      setActive(window.localStorage.getItem(WAKE_LOCK_STORAGE_KEY) === "1");
    } catch {
      setActive(false);
    }
  }, []);

  const release = useCallback(async () => {
    if (sentinelRef.current) {
      try {
        await sentinelRef.current.release();
      } catch {
        /* ignore */
      }
      sentinelRef.current = null;
    }
  }, []);

  const request = useCallback(async () => {
    if (!supported || typeof navigator === "undefined") return false;
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
      };
      if (!nav.wakeLock) return false;
      await release();
      sentinelRef.current = await nav.wakeLock.request("screen");
      return true;
    } catch {
      return false;
    }
  }, [release, supported]);

  useEffect(() => {
    if (!enabled || !active) {
      void release();
      return;
    }

    void request();

    const onVisible = () => {
      if (document.visibilityState === "visible" && active) {
        void request();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void release();
    };
  }, [enabled, active, request, release]);

  const toggle = useCallback(() => {
    setActive((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(WAKE_LOCK_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { active, supported, toggle };
}
