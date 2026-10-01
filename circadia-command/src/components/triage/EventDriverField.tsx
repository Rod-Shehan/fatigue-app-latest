"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  commandInput,
  commandLabel,
  commandPrimaryButton,
  commandTextMuted,
  commandTextPrimary,
} from "@/components/command/command-styles";
import { cn } from "@/lib/utils";

type Props = {
  lifecycleId: string;
  driverName: string | null;
  locked?: boolean;
};

export function EventDriverField({ lifecycleId, driverName, locked }: Props) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft("");
    setError(null);
  }, [lifecycleId]);

  const driversQuery = useQuery({
    queryKey: ["triage", "drivers"],
    queryFn: async () => {
      const res = await fetch("/api/v1/triage/drivers", { credentials: "same-origin" });
      const body = (await res.json()) as { drivers?: string[]; message?: string };
      if (!res.ok) throw new Error(body.message ?? "Could not load drivers.");
      return body.drivers ?? [];
    },
    enabled: !driverName,
    staleTime: 60_000,
  });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/triage/incidents/${lifecycleId}/driver`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_name: draft }),
      });
      const body = (await res.json()) as { driver_name?: string; message?: string };
      if (!res.ok) throw new Error(body.message ?? "Could not add the driver name.");
      const saved = body.driver_name ?? draft.trim();
      queryClient.setQueryData(
        ["triage", "live-queue"],
        (current: { incidents?: Array<{ lifecycle_id: string; driver_name: string | null }> } | undefined) => {
          if (!current?.incidents) return current;
          return {
            ...current,
            incidents: current.incidents.map((incident) =>
              incident.lifecycle_id === lifecycleId ? { ...incident, driver_name: saved } : incident
            ),
          };
        }
      );
      void queryClient.invalidateQueries({ queryKey: ["triage", "activity", lifecycleId] });
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the driver name.");
    } finally {
      setBusy(false);
    }
  };

  if (driverName) {
    return (
      <p className={cn("text-sm font-medium", commandTextPrimary)}>
        Driver · {driverName}
      </p>
    );
  }

  return (
    <form onSubmit={(event) => void save(event)} className="mt-2 space-y-2">
      <label className={commandLabel} htmlFor={`driver-name-${lifecycleId}`}>
        Add driver name
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`driver-name-${lifecycleId}`}
          list={`fleet-drivers-${lifecycleId}`}
          className={cn(commandInput, "mt-0")}
          value={draft}
          disabled={locked || busy}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Choose a roster driver or type a name"
          autoComplete="off"
        />
        <datalist id={`fleet-drivers-${lifecycleId}`}>
          {(driversQuery.data ?? []).map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <button type="submit" className={commandPrimaryButton} disabled={locked || busy || !draft.trim()}>
          {busy ? "Saving…" : "Add"}
        </button>
      </div>
      <p className={cn("text-xs", commandTextMuted)}>
        Autonomise did not send a driver. Add the name so this event can be published with it.
      </p>
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </form>
  );
}
