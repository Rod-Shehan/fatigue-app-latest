"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isManagerDeskAlertAudioUnlocked,
  isManagerDeskAlertMuted,
  playManagerDeskAlertTestSound,
  setManagerDeskAlertMuted,
} from "@/lib/manager-desk-alarm-audio";

export function useManagerDeskAlertControls() {
  const [muted, setMuted] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  useEffect(() => {
    setMuted(isManagerDeskAlertMuted());
    setAudioUnlocked(isManagerDeskAlertAudioUnlocked());
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      setManagerDeskAlertMuted(next);
      return next;
    });
  }, []);

  const enableAudio = useCallback(async () => {
    const ok = await playManagerDeskAlertTestSound();
    setAudioUnlocked(ok || isManagerDeskAlertAudioUnlocked());
    return ok;
  }, []);

  return { muted, audioUnlocked, toggleMuted, enableAudio };
}
