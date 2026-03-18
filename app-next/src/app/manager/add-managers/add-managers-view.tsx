"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import { UserPlus, Loader2, CheckCircle2 } from "lucide-react";

export function AddManagersView() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: { email: string; name?: string; password?: string }) => api.users.create(data),
    onSuccess: () => {
      setEmail("");
      setName("");
      setPassword("");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    createMutation.mutate({
      email: email.trim(),
      name: name.trim() || undefined,
      password: password.trim() ? password : undefined,
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-md mx-auto px-4 py-8 md:py-12">
        <PageHeader
          backHref="/manager"
          backLabel="Manager dashboard"
          title="Add Managers"
          subtitle="Create manager accounts for sign-in"
          icon={<UserPlus className="w-5 h-5" />}
        />
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Create a manager account. They can sign in on the login page with this email and password,
          then will be taken to the Manager dashboard automatically.
        </p>
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4"
        >
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold"
            >
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="manager@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9"
              required
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="name"
              className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold"
            >
              Name (optional)
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold"
            >
              Password (optional)
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Set a password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9"
            />
            <p className="text-[11px] text-slate-400">If set, they must use this password to sign in.</p>
          </div>
          {createMutation.isError && (
            <p className="text-sm text-red-600 font-medium" role="alert">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : "Failed to add manager"}
            </p>
          )}
          {createMutation.isSuccess && (
            <p className="text-sm text-green-600 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Manager added. They can sign in with this email.
            </p>
          )}
          <Button
            type="submit"
            className="w-full h-9 bg-slate-900 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white dark:text-slate-100 font-semibold gap-2"
            disabled={createMutation.isPending || !email.trim()}
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            Add manager
          </Button>
        </form>
      </div>
    </div>
  );
}
