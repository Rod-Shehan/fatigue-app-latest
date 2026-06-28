"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-command-border bg-command-panel p-8 shadow-xl">
        <h1 className="text-2xl font-bold tracking-tight">Circadia Command</h1>
        <p className="mt-2 text-sm text-slate-400">Sign in with username and password</p>

        <form className="mt-8 space-y-4" onSubmit={(e) => void signIn(e)}>
          <label className="block text-sm text-slate-300">
            Username
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-lg border border-command-border bg-command-bg px-3 py-2 text-slate-100 outline-none focus:border-command-amber"
              placeholder="your.username"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-command-border bg-command-bg px-3 py-2 text-slate-100 outline-none focus:border-command-amber"
              placeholder="Min. 6 characters"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-command-amber px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
