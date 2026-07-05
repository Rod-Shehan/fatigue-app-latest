"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isFatigueAlertAudioUnlocked,
  isFatigueAlertMuted,
  isFatigueAlertsArmed,
  playFatigueAlertTestSound,
  resumeFatigueAlertAudio,
  setFatigueAlertMuted,
} from "@/lib/fatigue-alert-audio";

export function useFatigueAlertControls() {
  const [muted, setMuted] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  useEffect(() => {
    setMuted(isFatigueAlertMuted());
    const armed = isFatigueAlertsArmed();
    setAudioUnlocked(armed || isFatigueAlertAudioUnlocked());
    if (armed) void resumeFatigueAlertAudio();

    const onVisible = () => {
      if (isFatigueAlertsArmed()) void resumeFatigueAlertAudio();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      setFatigueAlertMuted(next);
      return next;
    });
  }, []);

  const enableAudio = useCallback(async () => {
    const ok = await playFatigueAlertTestSound();
    setAudioUnlocked(ok || isFatigueAlertAudioUnlocked());
    return ok;
  }, []);

  return { muted, audioUnlocked, toggleMuted, enableAudio };
}
