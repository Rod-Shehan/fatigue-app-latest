"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import {
  CHECKLIST_EMAIL_SETTINGS_HINT,
  CHECKLIST_EMAIL_SETTINGS_LABEL,
} from "@/lib/checklist";
import { cn } from "@/lib/utils";
import { driverSectionLabel } from "@/components/driver/driver-ui-classes";

const KEY = ["settings", "checklist-delivery"] as const;

/** EWD Settings — where Fitness for Work / Prestart / Load week PDFs are emailed. */
export function ChecklistDeliverySettingsPanel({
  className,
  showOutboundStatus = false,
}: {
  className?: string;
  /** Ops detail — leave off on driver Settings. */
  showOutboundStatus?: boolean;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: KEY,
    queryFn: () => api.settings.getChecklistDelivery(),
  });

  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setEmail(query.data?.email ?? "");
  }, [query.data?.email]);

  const mutation = useMutation({
    mutationFn: () => api.settings.updateChecklistDelivery({ email }),
    onSuccess: () => {
      setFormError(null);
      setSavedFlash(true);
      void queryClient.invalidateQueries({ queryKey: KEY });
      window.setTimeout(() => setSavedFlash(false), 2500);
    },
    onError: (e: Error) => {
      setFormError(e.message || "Could not save email");
    },
  });

  return (
    <section className={cn("space-y-3", className)}>
      <h2 className={cn(driverSectionLabel, "flex items-center gap-2")}>
        <Mail className="w-4 h-4" aria-hidden />
        {CHECKLIST_EMAIL_SETTINGS_LABEL}
      </h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        {CHECKLIST_EMAIL_SETTINGS_HINT}
      </p>
      {query.isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="space-y-1.5">
            <Label
              htmlFor="checklist-delivery-email"
              className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold"
            >
              Email
            </Label>
            <Input
              id="checklist-delivery-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={query.data?.loginEmail || "you@company.com"}
              autoComplete="email"
              inputMode="email"
            />
          </div>
          {query.data?.usingLoginEmail && query.data.loginEmail ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Using your sign-in email. Change it here if packs should go somewhere else.
            </p>
          ) : null}
          {showOutboundStatus ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Server email send:{" "}
              {query.data?.outboundEmailConfigured
                ? "configured (RESEND_API_KEY + EMAIL_FROM)"
                : "not configured yet — set RESEND_API_KEY + EMAIL_FROM to send packs"}
            </p>
          ) : null}
          {formError ? <p className="text-xs text-red-600 dark:text-red-400">{formError}</p> : null}
          {savedFlash ? (
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Saved</p>
          ) : null}
          <Button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className="min-h-11 w-full sm:w-auto"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving…
              </>
            ) : (
              "Save checklist PDF email"
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
