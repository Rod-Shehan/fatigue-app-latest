"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const CONTACT_KEY = ["settings", "maintenance-contact"] as const;

/**
 * Org workshop / maintenance contact for WAHVA defect reporting.
 * Shown on EWD Settings (drivers) and manager/owner consoles.
 */
export function MaintenanceContactSettingsPanel({
  title = "Workshop contact",
  className,
  showOutboundStatus = false,
  hideHeading = false,
}: {
  title?: string;
  className?: string;
  /** Ops detail — leave off on driver Settings. */
  showOutboundStatus?: boolean;
  /** When nested in a framed Settings section. */
  hideHeading?: boolean;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: CONTACT_KEY,
    queryFn: () => api.settings.getMaintenanceContact(),
  });

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const c = query.data?.contact;
    if (!c) return;
    setName(c.name ?? "");
    setCompany(c.company ?? "");
    setEmail(c.email ?? "");
    setPhone(c.phone ?? "");
  }, [query.data?.contact]);

  const mutation = useMutation({
    mutationFn: () =>
      api.settings.updateMaintenanceContact({
        maintenanceContactName: name,
        maintenanceContactCompany: company,
        maintenanceContactEmail: email,
        maintenanceContactPhone: phone,
      }),
    onSuccess: () => {
      setFormError(null);
      setSavedFlash(true);
      void queryClient.invalidateQueries({ queryKey: CONTACT_KEY });
      void queryClient.invalidateQueries({ queryKey: ["admin", "policy"] });
      window.setTimeout(() => setSavedFlash(false), 2500);
    },
    onError: (e: Error) => {
      setFormError(e.message || "Could not save workshop contact");
    },
  });

  return (
    <section className={cn("space-y-3", className)}>
      {hideHeading ? null : (
        <>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Wrench className="w-4 h-4" aria-hidden />
            {title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Who should receive vehicle fault reports (WAHVA — defects must be reported for repair). Name,
            company, and email for your workshop or maintenance contact. Automatic email from Prestart is
            not enabled yet — this stores the destination for the reporting pathway.
          </p>
        </>
      )}
      {query.isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
          {hideHeading ? (
            <>
              <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                <Wrench className="w-4 h-4" aria-hidden />
                {title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Who should receive vehicle fault reports (WAHVA — defects must be reported for repair). Name,
                company, and email for your workshop or maintenance contact. Automatic email from Prestart is
                not enabled yet — this stores the destination for the reporting pathway.
              </p>
            </>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="maint-contact-name"
                className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold"
              >
                Contact name
              </Label>
              <Input
                id="maint-contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sam Workshop"
                autoComplete="name"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="maint-contact-company"
                className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold"
              >
                Company
              </Label>
              <Input
                id="maint-contact-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Fleet Maintenance Pty Ltd"
                autoComplete="organization"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="maint-contact-email"
                className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold"
              >
                Email *
              </Label>
              <Input
                id="maint-contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="workshop@example.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="maint-contact-phone"
                className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold"
              >
                Phone
              </Label>
              <Input
                id="maint-contact-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
                autoComplete="tel"
              />
            </div>
          </div>
          {showOutboundStatus ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Server email send:{" "}
              {query.data?.outboundEmailConfigured
                ? "configured (RESEND_API_KEY + EMAIL_FROM)"
                : "not configured yet — set RESEND_API_KEY + EMAIL_FROM when you enable reporting"}
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
              "Save workshop contact"
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
