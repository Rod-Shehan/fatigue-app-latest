"use client";

import { useEffect } from "react";
import { playCommandAlarmFromPush } from "@/lib/fatigue-alert-audio";

type PushAlarmMessage = {
  type?: string;
  lifecycleId?: string;
};

/** When a push arrives, play the desk alarm on any open triage tab (screen-on overnight). */
export function PushAlarmListener() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const onMessage = (event: MessageEvent<PushAlarmMessage>) => {
      if (event.data?.type !== "COMMAND_INCIDENT_PUSH") return;
      const lifecycleId = event.data.lifecycleId?.trim();
      if (!lifecycleId) return;
      void playCommandAlarmFromPush(lifecycleId);
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  return null;
}
