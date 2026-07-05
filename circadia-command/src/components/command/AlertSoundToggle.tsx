"use client";

import { Bell, BellOff, Volume2 } from "lucide-react";
import { commandOutlineButton } from "@/components/command/command-styles";

type Props = {
  muted: boolean;
  audioUnlocked: boolean;
  onToggleMuted: () => void;
  onEnableAudio: () => void;
  compact?: boolean;
};

export function AlertSoundToggle({
  muted,
  audioUnlocked,
  onToggleMuted,
  onEnableAudio,
  compact = false,
}: Props) {
  if (!audioUnlocked) {
    if (compact) {
      return (
        <button
          type="button"
          onClick={() => void onEnableAudio()}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/60 bg-amber-50 text-amber-900 transition-colors hover:border-amber-600 dark:border-amber-600/50 dark:bg-amber-950/40 dark:text-amber-200"
          title="Enable triage alert sounds"
          aria-label="Enable triage alert sounds"
        >
          <Volume2 className="h-4 w-4" aria-hidden />
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => void onEnableAudio()}
        className={`${commandOutlineButton} border-amber-500/60 text-amber-900 hover:border-amber-600 dark:border-amber-600/50 dark:text-amber-200 dark:hover:border-amber-500`}
        title="Enable triage alert sounds (plays a test alarm)"
      >
        <Volume2 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        Enable sounds
      </button>
    );
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={onToggleMuted}
        className={`${commandOutlineButton} h-9 w-9 shrink-0 px-0`}
        title={muted ? "Triage alerts muted" : "Triage alerts on"}
        aria-pressed={!muted}
        aria-label={muted ? "Triage alerts muted" : "Triage alerts on"}
      >
        {muted ? (
          <BellOff className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        ) : (
          <Bell className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggleMuted}
      className={commandOutlineButton}
      title={muted ? "Triage alerts muted" : "Triage alerts on"}
      aria-pressed={!muted}
    >
      {muted ? (
        <BellOff className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
      ) : (
        <Bell className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
      )}
      {muted ? "Alerts muted" : "Alert sounds"}
    </button>
  );
}
