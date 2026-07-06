"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getLastAlarmAt,
  isFatigueAlertMuted,
  isFatigueAlertsArmed,
  isRuntimeAudioUnlocked,
  needsFatigueAlertRearm,
  playFatigueAlertTestSound,
  rearmFatigueAlertsOnUserGesture,
  setFatigueAlertMuted,
  subscribeFatigueAlertState,
  tryResumeFatigueAlertAudio,
} from "@/lib/fatigue-alert-audio";

function readAudioUiState() {
  const armed = isFatigueAlertsArmed();
  const runtimeUnlocked = isRuntimeAudioUnlocked();
  return {
    armed,
    runtimeUnlocked,
    needsRearm: armed && !runtimeUnlocked,
    audioUnlocked: armed && runtimeUnlocked,
    lastAlarmAt: getLastAlarmAt(),
  };
}

export function useFatigueAlertControls() {
  const [muted, setMuted] = useState(false);
  const [armed, setArmed] = useState(false);
  const [runtimeUnlocked, setRuntimeUnlocked] = useState(false);
  const [lastAlarmAt, setLastAlarmAt] = useState<number | null>(null);

  const syncState = useCallback(() => {
    const next = readAudioUiState();
    setArmed(next.armed);
    setRuntimeUnlocked(next.runtimeUnlocked);
    setLastAlarmAt(next.lastAlarmAt);
  }, []);

  useEffect(() => {
    setMuted(isFatigueAlertMuted());
    syncState();
    if (isFatigueAlertsArmed()) void tryResumeFatigueAlertAudio().then(() => syncState());

    const onLifecycle = () => {
      void tryResumeFatigueAlertAudio().then(() => syncState());
    };

    document.addEventListener("visibilitychange", onLifecycle);
    window.addEventListener("pageshow", onLifecycle);
    window.addEventListener("focus", onLifecycle);
    const unsubscribe = subscribeFatigueAlertState(syncState);

    return () => {
      document.removeEventListener("visibilitychange", onLifecycle);
      window.removeEventListener("pageshow", onLifecycle);
      window.removeEventListener("focus", onLifecycle);
      unsubscribe();
    };
  }, [syncState]);

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      setFatigueAlertMuted(next);
      return next;
    });
  }, []);

  const enableAudio = useCallback(async () => {
    const ok = await playFatigueAlertTestSound();
    syncState();
    return ok;
  }, [syncState]);

  const resumeAudio = useCallback(async () => {
    const ok = await rearmFatigueAlertsOnUserGesture();
    syncState();
    return ok;
  }, [syncState]);

  const needsRearm = armed && !runtimeUnlocked;

  return {
    muted,
    armed,
    runtimeUnlocked,
    needsRearm,
    audioUnlocked: armed && runtimeUnlocked,
    lastAlarmAt,
    toggleMuted,
    enableAudio,
    resumeAudio,
  };
}
