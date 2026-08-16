"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CIRCADIA_DESK_PATH, CIRCADIA_DESK_TAGLINE, CIRCADIA_DESK_TITLE } from "@/lib/circadia-desk";
import { CLIENT_PAUSED_ERROR, CLIENT_PAUSED_MESSAGE } from "@/lib/tenant";
import { ALPHA_RESTRICTED_ERROR } from "@/lib/auth-alpha-allowlist";
import { ROSTER_LOGIN_ERROR, ROSTER_LOGIN_MESSAGE } from "@/lib/driver-login-gate";

export function CircadiaSignIn({ signedInEmail }: { signedInEmail: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (signedInEmail) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 space-y-4">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{CIRCADIA_DESK_TITLE}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Signed in as <span className="font-semibold">{signedInEmail}</span>. This desktop desk is
          for Circadia staff only.
        </p>
        <Button
          type="button"
          onClick={() => {
            void signOut({ callbackUrl: CIRCADIA_DESK_PATH });
          }}
        >
          Sign out
        </Button>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        callbackUrl: CIRCADIA_DESK_PATH,
        redirect: false,
      });
      if (res?.error) {
        setError(
          res.error === CLIENT_PAUSED_ERROR
            ? CLIENT_PAUSED_MESSAGE
            : res.error === ALPHA_RESTRICTED_ERROR
              ? "This email is not on the approved pilot list yet."
              : res.error === ROSTER_LOGIN_ERROR
                ? ROSTER_LOGIN_MESSAGE
                : "Invalid email or password."
        );
        setLoading(false);
        return;
      }
      window.location.replace(CIRCADIA_DESK_PATH);
    } catch {
      setError("Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mx-auto max-w-md px-6 py-16 space-y-5">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{CIRCADIA_DESK_TITLE}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{CIRCADIA_DESK_TAGLINE}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="circadia-email">Email</Label>
        <Input
          id="circadia-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="circadia-password">Password</Label>
        <Input
          id="circadia-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="h-11"
        />
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full h-11" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
