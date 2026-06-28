"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

export function DriverSettingsChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.driver.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) return;
    mutation.mutate();
  }

  const confirmMismatch =
    confirmPassword.length > 0 && newPassword.length > 0 && newPassword !== confirmPassword;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <KeyRound className="w-4 h-4 text-slate-500" aria-hidden />
        Change password
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        Choose a password only you know. Your manager cannot see it after you save — they can reset it if you need help signing in.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="driver-current-password" className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          Current password
        </Label>
        <Input
          id="driver-current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="driver-new-password" className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          New password
        </Label>
        <Input
          id="driver-new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={6}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="driver-confirm-password" className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          Confirm new password
        </Label>
        <Input
          id="driver-confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={6}
          required
        />
      </div>
      {confirmMismatch && (
        <p className="text-sm text-red-600 font-medium" role="alert">
          New passwords do not match.
        </p>
      )}
      {mutation.isError && (
        <p className="text-sm text-red-600 font-medium" role="alert">
          {mutation.error instanceof Error ? mutation.error.message : "Could not change password."}
        </p>
      )}
      {mutation.isSuccess && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium" role="status">
          Password updated. Use your new password next time you sign in.
        </p>
      )}
      <Button
        type="submit"
        className="w-full"
        disabled={
          mutation.isPending ||
          !currentPassword ||
          !newPassword ||
          newPassword.length < 6 ||
          newPassword !== confirmPassword
        }
      >
        {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update password"}
      </Button>
    </form>
  );
}
