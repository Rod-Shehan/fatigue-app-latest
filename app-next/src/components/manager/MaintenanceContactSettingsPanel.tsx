"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

const CONTACT_KEY = ["manager", "maintenance-contact"] as const;

/**
 * Org workshop / maintenance contact for WAHVA defect reporting.
 * Destination email for the reporting pathway (send process comes next).
 */
export function MaintenanceContactSettingsPanel({
  title = "Maintenance contact",
}: {
  title?: string;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: CONTACT_KEY,
    queryFn: () => api.manager.getMaintenanceContact(),
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
      api.manager.updateMaintenanceContact({
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
      setFormError(e.message || "Could not save maintenance contact");
    },
  });

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
        <Wrench className="w-4 h-4" aria-hidden />
        {title}
      </h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        Workshop or maintenance person/company who receives vehicle fault reports (WAHVA accreditation —
        defects must be reported for repair). Used by the upcoming prestart reporting pathway. Does not
        email automatically until that process is enabled.
      </p>
      {query.isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="maint-contact-name" className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
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
              <Label htmlFor="maint-contact-company" className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
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
              <Label htmlFor="maint-contact-email" className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
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
              <Label htmlFor="maint-contact-phone" className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
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
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Server email send:{" "}
            {query.data?.outboundEmailConfigured
              ? "configured (RESEND_API_KEY + EMAIL_FROM)"
              : "not configured yet — set RESEND_API_KEY + EMAIL_FROM when you enable reporting"}
          </p>
          {formError ? <p className="text-xs text-red-600 dark:text-red-400">{formError}</p> : null}
          {savedFlash ? (
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Saved</p>
          ) : null}
          <Button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className="min-h-11"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving…
              </>
            ) : (
              "Save maintenance contact"
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
