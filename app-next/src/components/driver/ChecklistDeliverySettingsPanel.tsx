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

const KEY = ["settings", "checklist-pack"] as const;

/** Enterprise Owner console — fleet checklist PDF pack destinations. */
export function ChecklistDeliverySettingsPanel({
  className,
  showOutboundStatus = false,
}: {
  className?: string;
  showOutboundStatus?: boolean;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: KEY,
    queryFn: () => api.settings.getChecklistPack(),
  });

  const [email, setEmail] = useState("");
  const [spareEmail1, setSpareEmail1] = useState("");
  const [spareEmail2, setSpareEmail2] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const pack = query.data?.pack;
    if (!pack) return;
    setEmail(pack.email ?? "");
    setSpareEmail1(pack.spareEmail1 ?? "");
    setSpareEmail2(pack.spareEmail2 ?? "");
  }, [query.data?.pack]);

  const mutation = useMutation({
    mutationFn: () =>
      api.settings.updateChecklistPack({
        checklistPackEmail: email,
        checklistPackSpareEmail1: spareEmail1,
        checklistPackSpareEmail2: spareEmail2,
      }),
    onSuccess: () => {
      setFormError(null);
      setSavedFlash(true);
      void queryClient.invalidateQueries({ queryKey: KEY });
      void queryClient.invalidateQueries({ queryKey: ["admin", "policy"] });
      window.setTimeout(() => setSavedFlash(false), 2500);
    },
    onError: (e: Error) => {
      setFormError(e.message || "Could not save pack emails");
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label
                htmlFor="checklist-pack-email"
                className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold"
              >
                Pack email *
              </Label>
              <Input
                id="checklist-pack-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="records@company.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="checklist-pack-spare-1"
                className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold"
              >
                Spare email 1
              </Label>
              <Input
                id="checklist-pack-spare-1"
                type="email"
                value={spareEmail1}
                onChange={(e) => setSpareEmail1(e.target.value)}
                placeholder="Optional extra inbox"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="checklist-pack-spare-2"
                className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold"
              >
                Spare email 2
              </Label>
              <Input
                id="checklist-pack-spare-2"
                type="email"
                value={spareEmail2}
                onChange={(e) => setSpareEmail2(e.target.value)}
                placeholder="Optional extra inbox"
                autoComplete="off"
              />
            </div>
          </div>
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
              "Save pack emails"
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
