"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Download, FolderOpen, Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ManagerSubnav } from "@/components/manager/ManagerSubnav";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, type Driver, type FatigueSheet } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MANAGER_EXPERIENCE, MANAGER_PAGE_SHELL } from "@/lib/manager-experience";
import {
  defaultRecordsWeekId,
  formatRecordsWeekOption,
  isWeekRecordSigned,
  sheetsForRosterDriver,
  sortRecordsWeeks,
} from "@/lib/manager-records";
import { getThisWeekSunday } from "@/lib/weeks";

function sortRosterDrivers(drivers: Driver[]): Driver[] {
  return [...drivers].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export function ManagerRecordsView() {
  const thisWeekSunday = useMemo(() => getThisWeekSunday(), []);
  const [query, setQuery] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedSheetId, setSelectedSheetId] = useState("");

  const driversQuery = useQuery({
    queryKey: ["drivers"],
    queryFn: () => api.drivers.list(),
  });
  const sheetsQuery = useQuery({
    queryKey: ["sheets", "meta", "records"],
    queryFn: () => api.sheets.list({ meta: true }),
  });

  const drivers = useMemo(
    () => sortRosterDrivers(driversQuery.data ?? []),
    [driversQuery.data]
  );
  const filteredDrivers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter((d) => d.name.toLowerCase().includes(q));
  }, [drivers, query]);

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId) ?? null;

  useEffect(() => {
    if (selectedDriverId) return;
    if (drivers.length > 0) setSelectedDriverId(drivers[0]!.id);
  }, [drivers, selectedDriverId]);

  const driverSheets = useMemo(() => {
    if (!selectedDriver) return [];
    return sortRecordsWeeks(
      sheetsForRosterDriver(sheetsQuery.data ?? [], selectedDriver.name),
      thisWeekSunday
    );
  }, [selectedDriver, sheetsQuery.data, thisWeekSunday]);

  useEffect(() => {
    if (driverSheets.length === 0) {
      setSelectedSheetId("");
      return;
    }
    setSelectedSheetId((prev) =>
      driverSheets.some((s) => s.id === prev) ? prev : defaultRecordsWeekId(driverSheets, thisWeekSunday)
    );
  }, [driverSheets, thisWeekSunday]);

  const selectedSheet = driverSheets.find((s) => s.id === selectedSheetId) ?? null;

  function exportPdf(sheet: FatigueSheet) {
    window.open(api.sheets.exportPdfUrl(sheet.id), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className={MANAGER_PAGE_SHELL}>
        <PageHeader
          backHref="/manager"
          backLabel={MANAGER_EXPERIENCE.NAV_RISK_BRIEF}
          backText={MANAGER_EXPERIENCE.NAV_OVERVIEW}
          title={MANAGER_EXPERIENCE.NAV_RECORDS}
          subtitle={MANAGER_EXPERIENCE.RECORDS_PAGE_SUBTITLE}
          icon={<FolderOpen className="w-5 h-5" />}
        />
        <ManagerSubnav />

        <div className="grid gap-4 md:grid-cols-[minmax(16rem,20rem)_1fr] md:items-start">
          <aside className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Drivers</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Everyone on the roster
              </p>
              <label className="relative mt-3 block">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search drivers"
                  className="h-9 pl-8"
                  aria-label="Search drivers"
                />
              </label>
            </div>
            {driversQuery.isLoading ? (
              <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading drivers…
              </div>
            ) : filteredDrivers.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                {drivers.length === 0
                  ? MANAGER_EXPERIENCE.RECORDS_NO_DRIVERS
                  : "No names match that search."}
              </p>
            ) : (
              <ul className="max-h-[70vh] overflow-y-auto py-1" role="listbox" aria-label="Drivers">
                {filteredDrivers.map((driver) => {
                  const active = driver.id === selectedDriver?.id;
                  return (
                    <li key={driver.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => setSelectedDriverId(driver.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm",
                          active
                            ? "bg-teal-700 text-white"
                            : "text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
                        )}
                      >
                        <span className="min-w-0 truncate font-medium">{driver.name}</span>
                        {!driver.is_active ? (
                          <span
                            className={cn(
                              "shrink-0 text-[10px] uppercase tracking-wide",
                              active ? "text-white/80" : "text-slate-400"
                            )}
                          >
                            Inactive
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            {!selectedDriver ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {MANAGER_EXPERIENCE.RECORDS_PICK_DRIVER}
              </p>
            ) : (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                    {selectedDriver.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Previous weeks first. Export PDF is the same Weekly Trip Sheet as on the week
                    record.
                  </p>
                </div>

                {sheetsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Loading weeks…
                  </div>
                ) : driverSheets.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {MANAGER_EXPERIENCE.RECORDS_NO_WEEKS}
                  </p>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="records-week">{MANAGER_EXPERIENCE.RECORDS_WEEK_LABEL}</Label>
                      <Select value={selectedSheetId} onValueChange={setSelectedSheetId}>
                        <SelectTrigger id="records-week" className="w-full max-w-md">
                          <SelectValue placeholder="Choose a week" />
                        </SelectTrigger>
                        <SelectContent>
                          {driverSheets.map((sheet) => (
                            <SelectItem key={sheet.id} value={sheet.id}>
                              {formatRecordsWeekOption({
                                weekStarting: sheet.week_starting,
                                thisWeekSunday,
                                signed: isWeekRecordSigned(sheet.status, sheet.signature),
                              })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedSheet ? (
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/sheets/${selectedSheet.id}`}
                          className={cn(
                            buttonVariants({ variant: "default" }),
                            "bg-teal-700 hover:bg-teal-800 text-white"
                          )}
                        >
                          {MANAGER_EXPERIENCE.RECORDS_VIEW_WEEK}
                        </Link>
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2"
                          onClick={() => exportPdf(selectedSheet)}
                        >
                          <Download className="h-4 w-4" aria-hidden />
                          {MANAGER_EXPERIENCE.RECORDS_EXPORT_PDF}
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
