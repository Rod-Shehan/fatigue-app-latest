"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shield } from "lucide-react";
import { CommandShell } from "@/components/command/CommandShell";
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
      <div className={`mx-auto w-full max-w-md ${commandCard} p-8`}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white shadow-sm ring-1 ring-slate-700/80">
            <Shield className="h-5 w-5" strokeWidth={2} aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">Circadia Command</h1>
            <p className="text-sm text-slate-400">Sign in with username and password</p>
          </div>
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
    </CommandShell>
  );
}
