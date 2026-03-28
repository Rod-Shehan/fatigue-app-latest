"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getSpeechRecognitionConstructor,
  isVoiceCommandInputSupported,
  matchStrictVoiceIntent,
  type SpeechRecognitionCtor,
  type VoiceIntent,
  VOICE_COMMAND_HINT,
} from "@/lib/voice-command-input";

type RecInstance = InstanceType<SpeechRecognitionCtor>;

type VoiceLabels = {
  work: string;
  break: string;
  stop: string;
};

type Props = {
  voiceLabels: VoiceLabels;
  /** Called only after the user confirms the Alexa-style dialog (compliance write). */
  onConfirmIntent: (intent: VoiceIntent) => void;
  className?: string;
  disabled?: boolean;
  /** When false, "end shift" / stop intent is ignored and a banner explains why (e.g. no open work/break). */
  allowStopIntent?: boolean;
};

export function VoiceCommandControl({
  voiceLabels,
  onConfirmIntent,
  className,
  disabled,
  allowStopIntent = true,
}: Props) {
  const [listening, setListening] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState<{
    intent: VoiceIntent;
    heard: string;
    actionLabel: string;
  } | null>(null);
  const recRef = useRef<RecInstance | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const Ctor = typeof window !== "undefined" ? getSpeechRecognitionConstructor() : null;
  const supported = typeof window !== "undefined" && isVoiceCommandInputSupported();

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    try {
      recRef.current?.stop?.();
      recRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
    clearTimers();
  }, [clearTimers]);

  useEffect(() => () => stopListening(), [stopListening]);

  const intentToLabel = useCallback(
    (intent: VoiceIntent): string => {
      if (intent === "work") return voiceLabels.work;
      if (intent === "break") return voiceLabels.break;
      return voiceLabels.stop;
    },
    [voiceLabels]
  );

  const startListening = useCallback(() => {
    if (!Ctor || disabled) return;
    setBanner(null);
    stopListening();

    const rec = new Ctor() as RecInstance;
    recRef.current = rec;
    rec.lang = "en-AU";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (ev: Event) => {
      const results = (ev as unknown as { results: { [i: number]: { [j: number]: { transcript: string } } } }).results;
      const transcript = results?.[0]?.[0]?.transcript ?? "";
      const matched = matchStrictVoiceIntent(transcript);
      stopListening();
      if (!matched) {
        setBanner(`No match. ${VOICE_COMMAND_HINT}`);
        return;
      }
      if (matched.intent === "stop" && !allowStopIntent) {
        setBanner("No shift to end — start work or a break first.");
        return;
      }
      const actionLabel = intentToLabel(matched.intent);
      setPending({
        intent: matched.intent,
        heard: transcript.trim(),
        actionLabel,
      });
      setConfirmOpen(true);
    };

    rec.onerror = (ev: Event) => {
      const err = (ev as unknown as { error?: string }).error ?? "unknown";
      stopListening();
      if (err === "not-allowed" || err === "service-not-allowed") {
        setBanner("Microphone access denied. Allow the mic for this site in browser settings.");
      } else if (err !== "aborted" && err !== "no-speech") {
        setBanner(`Voice input error (${err}). Try again or use the buttons.`);
      }
    };

    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };

    try {
      setListening(true);
      rec.start();
      timeoutRef.current = setTimeout(() => {
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }, 18000);
    } catch {
      setListening(false);
      setBanner("Could not start voice input. Use the buttons instead.");
    }
  }, [Ctor, disabled, intentToLabel, stopListening, allowStopIntent]);

  const handleConfirm = () => {
    if (!pending) return;
    onConfirmIntent(pending.intent);
    setPending(null);
    setConfirmOpen(false);
  };

  const handleCancel = () => {
    setPending(null);
    setConfirmOpen(false);
  };

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || !supported}
          className={cn(
            "h-11 w-11 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
            listening && "ring-2 ring-cyan-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 animate-pulse",
            className
          )}
          aria-pressed={listening}
          title={
            supported
              ? listening
                ? "Listening… say a command, e.g. start shift or take a break"
                : `Voice — ${VOICE_COMMAND_HINT}`
              : "Voice commands are not supported in this browser"
          }
          aria-label={listening ? "Listening for voice command" : "Start voice command"}
          onClick={() => {
            if (listening) stopListening();
            else startListening();
          }}
        >
          <Mic className="h-6 w-6" aria-hidden />
        </Button>
        {banner && (
          <p className="max-w-[min(18rem,85vw)] text-[10px] text-amber-800 dark:text-amber-200 text-right leading-snug">
            {banner}
          </p>
        )}
        {!supported && (
          <p className="max-w-[min(18rem,85vw)] text-[10px] text-slate-500 dark:text-slate-400 text-right leading-snug hidden sm:block">
            Voice commands need a browser with speech recognition (e.g. Chrome on Android).
          </p>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={(o) => !o && handleCancel()}>
        <DialogContent className="sm:max-w-md" aria-describedby="voice-confirm-desc">
          <DialogHeader>
            <DialogTitle>Confirm shift action</DialogTitle>
            <DialogDescription id="voice-confirm-desc" className="space-y-2 text-left">
              <span className="block text-base text-slate-900 dark:text-slate-100 font-medium">
                Did you want to <span className="text-slate-950 dark:text-white">{pending?.actionLabel}</span>?
              </span>
              {pending?.heard ? (
                <span className="block text-sm text-slate-600 dark:text-slate-400">
                  We heard: &quot;{pending.heard}&quot;
                </span>
              ) : null}
              <span className="block text-xs text-slate-500 dark:text-slate-500">
                This will log the same as tapping the button — only confirm if that is correct.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirm}>
              Yes, log it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
