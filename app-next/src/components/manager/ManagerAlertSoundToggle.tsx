"use client";

import { Bell, BellOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  muted: boolean;
  audioUnlocked: boolean;
  onToggleMuted: () => void;
  onEnableAudio: () => void;
};

export function ManagerAlertSoundToggle({
  muted,
  audioUnlocked,
  onToggleMuted,
  onEnableAudio,
}: Props) {
  if (!audioUnlocked) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-amber-300 text-amber-900 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200"
        onClick={() => void onEnableAudio()}
        title="Enable live alert sounds (plays a test alarm)"
      >
        <Volume2 className="mr-1.5 h-4 w-4" aria-hidden />
        Enable sounds
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onToggleMuted}
      title={muted ? "Live alerts muted" : "Live alert sounds on"}
      aria-pressed={!muted}
    >
      {muted ? (
        <BellOff className="mr-1.5 h-4 w-4" aria-hidden />
      ) : (
        <Bell className="mr-1.5 h-4 w-4" aria-hidden />
      )}
      {muted ? "Muted" : "Alert sounds"}
    </Button>
  );
}
