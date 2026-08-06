"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_NAME } from "@/lib/branding";
import { MIN_USER_PASSWORD_LENGTH } from "@/lib/user-password";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = useMemo(() => (searchParams.get("token") || "").trim(), [searchParams]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("This reset link is missing a token. Request a new link from Sign in.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not reset password.");
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Could not reset password. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-6 space-y-5">
        <div className="space-y-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{PRODUCT_NAME}</p>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Reset password</h1>
        </div>

        {!token ? (
          <p className="text-sm text-red-600 font-medium" role="alert">
            This reset link is incomplete. Go back to Sign in and tap Forgot password.
          </p>
        ) : done ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
              Password updated. You can sign in with your new password.
            </p>
            <Link
              href="/?branch=driver"
              className="inline-flex h-12 w-full items-center justify-center rounded-md bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                New password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 text-base"
                required
                minLength={MIN_USER_PASSWORD_LENGTH}
              />
              <p className="text-[11px] text-slate-500">At least {MIN_USER_PASSWORD_LENGTH} characters.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                Confirm password
              </Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-12 text-base"
                required
                minLength={MIN_USER_PASSWORD_LENGTH}
              />
            </div>
            {error ? (
              <p className="text-sm text-red-600 font-medium" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              className="w-full h-12 text-base bg-slate-900 hover:bg-slate-800 text-white font-semibold"
              disabled={loading}
            >
              {loading ? "Saving…" : "Save new password"}
            </Button>
            <Link
              href="/"
              className="block w-full text-center text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500">
          Loading…
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
