"use client";

import { Bell, BellOff, Volume2 } from "lucide-react";
import { commandOutlineButton } from "@/components/command/command-styles";

type Props = {
  muted: boolean;
  audioUnlocked: boolean;
  onToggleMuted: () => void;
  onEnableAudio: () => void;
};

export function AlertSoundToggle({ muted, audioUnlocked, onToggleMuted, onEnableAudio }: Props) {
  if (!audioUnlocked) {
    return (
      <button
        type="button"
        onClick={() => void onEnableAudio()}
        className={`${commandOutlineButton} border-amber-600/50 text-amber-200 hover:border-amber-500`}
        title="Enable fatigue alert sounds"
      >
        <Volume2 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        Enable sounds
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggleMuted}
      className={commandOutlineButton}
      title={muted ? "Fatigue alerts muted" : "Fatigue alerts on (on shift)"}
      aria-pressed={!muted}
    >
      {muted ? (
        <BellOff className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
      ) : (
        <Bell className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
      )}
      {muted ? "Alerts muted" : "Fatigue alerts"}
    </button>
  );
}
