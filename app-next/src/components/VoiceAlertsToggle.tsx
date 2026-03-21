"use client";

import React from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setVoiceAlertsEnabled, speakVoiceAlert } from "@/lib/voice-alerts";

type Props = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  className?: string;
};

/**
 * Toggle stored in localStorage; turning on runs a short test phrase (unlocks audio on many browsers).
 */
export function VoiceAlertsToggle({ enabled, onChange, className }: Props) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "h-11 w-11 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
        className
      )}
      aria-pressed={enabled}
      title={enabled ? "Voice alerts on — tap to turn off" : "Voice alerts off — tap to turn on"}
      aria-label={enabled ? "Voice alerts on" : "Voice alerts off"}
      onClick={() => {
        const next = !enabled;
        setVoiceAlertsEnabled(next);
        onChange(next);
        if (next) {
          speakVoiceAlert("Voice alerts on.");
        }
      }}
    >
      {enabled ? <Volume2 className="h-6 w-6" aria-hidden /> : <VolumeX className="h-6 w-6" aria-hidden />}
    </Button>
  );
}
