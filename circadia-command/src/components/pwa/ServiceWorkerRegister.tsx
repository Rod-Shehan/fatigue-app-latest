"use client";

import { useEffect } from "react";

/** Registers shell-only service worker in production (skipped in dev). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* PWA install still works without SW */
    });
  }, []);

  return null;
}
