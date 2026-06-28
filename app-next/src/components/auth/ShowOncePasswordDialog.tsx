"use client";

import { Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ShowOncePasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountLabel: string;
  email: string;
  temporaryPassword: string;
};

export function ShowOncePasswordDialog({
  open,
  onOpenChange,
  accountLabel,
  email,
  temporaryPassword,
}: ShowOncePasswordDialogProps) {
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Temporary password — copy now</DialogTitle>
          <DialogDescription>
            This is shown once. Share it with {accountLabel} for sign-in. They should change it after logging in.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-4 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Email</p>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 break-all">{email}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Password</p>
            <p className="text-lg font-mono font-semibold text-slate-900 dark:text-slate-100 tracking-wide">
              {temporaryPassword}
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => void copyPassword()} className="gap-2">
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied" : "Copy password"}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
