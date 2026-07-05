"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircadiaLogo } from "@/components/branding/CircadiaLogo";
import { CommandShell } from "@/components/command/CommandShell";
import { InstallCommandApp } from "@/components/pwa/InstallCommandApp";
import {
  commandCard,
  commandInput,
  commandLabel,
  commandPrimaryButton,
} from "@/components/command/command-styles";
import { unlockFatigueAlertAudio } from "@/lib/fatigue-alert-audio";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    void unlockFatigueAlertAudio();
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Sign-in failed");
      router.replace(body.role === "command_owner" ? "/admin/users" : "/triage");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <CommandShell className="flex items-center">
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className={`${commandCard} p-8`}>
        <div className="flex flex-col items-center text-center">
          <CircadiaLogo variant="full" href={null} priority />
          <p className="mt-3 text-sm text-slate-400">Command · sign in with username and password</p>
        </div>

        <form className="mt-8 space-y-4" onSubmit={(e) => void signIn(e)}>
          <label className={commandLabel}>
            Username
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={commandInput}
              placeholder="your.username"
            />
          </label>
          <label className={commandLabel}>
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={commandInput}
              placeholder="Min. 6 characters"
            />
          </label>
          <button type="submit" disabled={busy} className={`${commandPrimaryButton} w-full py-2.5`}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        </div>

        <InstallCommandApp compact />
      </div>
    </CommandShell>
  );
}
