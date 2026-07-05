"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isFatigueAlertAudioUnlocked,
  isFatigueAlertMuted,
  playFatigueAlertTestSound,
  setFatigueAlertMuted,
} from "@/lib/fatigue-alert-audio";

export function useFatigueAlertControls() {
  const [muted, setMuted] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  useEffect(() => {
    setMuted(isFatigueAlertMuted());
    setAudioUnlocked(isFatigueAlertAudioUnlocked());
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
