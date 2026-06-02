"use client";

import { useEffect, useState } from "react";
import { Moon, Volume2 } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { SettingsToggleRow } from "@/components/driver/SettingsToggleRow";
import { getVoiceAlertsEnabled, setVoiceAlertsEnabled, speakVoiceAlert } from "@/lib/voice-alerts";

export function DriverSettingsOptions() {
  const { resolved, setTheme } = useTheme();
  const [voiceAlerts, setVoiceAlerts] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setVoiceAlerts(getVoiceAlertsEnabled());
  }, []);

  if (!mounted) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden px-4 py-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading options…</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-200 dark:divide-slate-700">
      <SettingsToggleRow
        id="settings-dark-mode"
        icon={<Moon className="w-5 h-5" />}
        title="Dark mode"
        description="Easier on the eyes at night"
        checked={resolved === "dark"}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
      />
      <SettingsToggleRow
        id="settings-voice-alerts"
        icon={<Volume2 className="w-5 h-5" />}
        title="Voice alerts"
        description="Spoken reminders while logging"
        checked={voiceAlerts}
        onCheckedChange={(checked) => {
          setVoiceAlertsEnabled(checked);
          setVoiceAlerts(checked);
          if (checked) speakVoiceAlert("Voice alerts on.");
        }}
      />
    </div>
  );
}
