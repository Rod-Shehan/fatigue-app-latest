"use client";

import { useEffect } from "react";
import { isCircadiaDeskHostname, isLegacyCircadiaDeskHostname } from "@/lib/circadia-desk";

/**
 * Registers shell-only service worker in production builds.
 * Skipped in dev to avoid conflicting with Next.js HMR.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (window.location.pathname.startsWith("/circadia")) return;
    if (
      isCircadiaDeskHostname(window.location.hostname) ||
      isLegacyCircadiaDeskHostname(window.location.hostname)
    ) {
      return;
    }

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* optional — PWA still works without SW */
    });
  }, []);

  return null;
}
