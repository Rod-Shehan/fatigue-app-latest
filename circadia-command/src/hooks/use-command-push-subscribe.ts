"use client";

import { useCallback, useEffect, useState } from "react";

type PushSubscriptionJson = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function subscriptionToJson(sub: PushSubscription): PushSubscriptionJson {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Invalid push subscription");
  }
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

async function syncSubscriptionWithServer(sub: PushSubscription): Promise<boolean> {
  const body = subscriptionToJson(sub);
  const res = await fetch("/api/v1/alerts/push-subscribe", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export function useCommandPushSubscribe() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const refreshPushState = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      setSubscribed(false);
      return;
    }

    setPermission(Notification.permission);
    if (Notification.permission !== "granted") {
      setSubscribed(false);
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (!existing) {
        setSubscribed(false);
        return;
      }
      const ok = await syncSubscriptionWithServer(existing);
      setSubscribed(ok);
      if (!ok) setLastError("Could not register this device for background alerts.");
    } catch {
      setSubscribed(false);
    }
  }, []);

  useEffect(() => {
    void refreshPushState();
  }, [refreshPushState]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;

    setBusy(true);
    setLastError(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setLastError("Notification permission denied.");
        return false;
      }

      const vapidRes = await fetch("/api/v1/alerts/push-vapid-public", { credentials: "same-origin" });
      if (!vapidRes.ok) {
        setLastError("Background alerts are not configured on the server.");
        return false;
      }
      const { publicKey } = (await vapidRes.json()) as { publicKey?: string };
      if (!publicKey) {
        setLastError("Background alerts are not configured on the server.");
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }));

      const ok = await syncSubscriptionWithServer(sub);
      if (!ok) {
        setLastError("Could not save background alert subscription.");
        return false;
      }
      setSubscribed(true);
      return true;
    } catch {
      setLastError("Background alert setup failed in this browser.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    setBusy(true);
    setLastError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/v1/alerts/push-subscribe", {
          method: "DELETE",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, []);

  return { permission, subscribed, busy, lastError, subscribe, unsubscribe, refreshPushState };
}
