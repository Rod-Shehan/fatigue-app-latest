"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ChevronRight, Users } from "lucide-react";
import { api } from "@/lib/api";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import {
  fleetHeatmapLabelIndices,
  findFleetNowIndex,
  type FleetDriverRiskRow,
} from "@/lib/frms/fleet-risk-timeline";
import { RISK_COLOR_THRESHOLDS, riskPercentToColor } from "@/lib/manager-risk-timeline";
import { cn } from "@/lib/utils";

function cellBackground(pct: number): string {
  const base = riskPercentToColor(pct);
  if (pct >= RISK_COLOR_THRESHOLDS.red) return `${base}cc`;
  if (pct >= RISK_COLOR_THRESHOLDS.amber) return `${base}99`;
  return `${base}44`;
}

function DriverHeatmapRow({
  row,
  nowIndex,
  selected,
  rank,
  onSelect,
}: {
  row: FleetDriverRiskRow;
  nowIndex: number;
  selected: boolean;
  rank: number;
  onSelect: (name: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(row.driverName)}
      className={cn(
        "group flex w-full min-w-0 items-stretch gap-0 border-b border-slate-100 text-left transition-colors dark:border-slate-800",
        selected
          ? "bg-teal-50/80 dark:bg-teal-950/40"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
        rank <= 3 && !selected && "bg-rose-50/30 dark:bg-rose-950/20"
      )}
    >
      <div className="sticky left-0 z-10 flex w-[9.5rem] shrink-0 items-center gap-2 border-r border-slate-100 bg-inherit px-3 py-2 dark:border-slate-800 sm:w-[11rem]">
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
            rank <= 3
              ? "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          )}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
            {row.driverName}
          </p>
          <p className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
            now {row.nowPct ?? "—"}% · peak 24h {row.peakNext24Pct ?? "—"}%
          </p>
        </div>
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-teal-600 dark:text-slate-600 dark:group-hover:text-teal-400"
          aria-hidden
        />
      </div>
      <div className="flex min-w-0 flex-1">
        {row.cells.map((cell, i) => (
          <div
            key={cell.blockStartMs}
            title={`${row.driverName} · ${cell.label} · ${cell.pct}%`}
            className={cn(
              "h-10 min-w-[6px] flex-1 sm:min-w-[8px]",
              i === nowIndex && "ring-1 ring-inset ring-teal-500 dark:ring-teal-400"
            )}
            style={{ backgroundColor: cellBackground(cell.pct) }}
          />
        ))}
      </div>
    </button>
  );
}

export function ManagerFleetRiskPulse({
  weekStarting,
  driverNames,
  selectedDriver,
  onSelectDriver,
}: {
  weekStarting: string;
  driverNames: string[];
  selectedDriver?: string;
  onSelectDriver: (name: string) => void;
}) {
  const namesKey = driverNames.join("\0");

  const { data, isLoading, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["manager", "fleet-risk-timeline", weekStarting, namesKey],
    queryFn: () =>
      api.manager.fleetRiskTimeline({
        weekStarting,
        driverNames: driverNames.length ? driverNames : undefined,
      }),
    enabled: !!weekStarting,
    refetchInterval: 5 * 60 * 1000,
  });

  const labelIndices = useMemo(
    () => fleetHeatmapLabelIndices(data?.columnLabels.length ?? 0),
    [data?.columnLabels.length]
  );

  const nowIndex = useMemo(() => {
    const first = data?.drivers[0]?.cells ?? [];
    return findFleetNowIndex(first, data?.nowBlockStartMs ?? 0);
  }, [data?.drivers, data?.nowBlockStartMs]);

  const elevatedCount = useMemo(() => {
    if (!data?.drivers.length) return 0;
    return data.drivers.filter(
      (d) => (d.nowPct ?? 0) >= RISK_COLOR_THRESHOLDS.amber || (d.peakNext24Pct ?? 0) >= RISK_COLOR_THRESHOLDS.red
    ).length;
  }, [data?.drivers]);

  const scoringBadge =
    data?.scoring_engine === "frms"
      ? "TPMA · fleet"
      : data?.scoring_engine === "mixed"
        ? "TPMA · partial"
        : "Demo / legacy";

  const updatedLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Australia/Perth",
      })
    : null;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-teal-200/90 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white shadow-xl dark:border-teal-800/60"
      aria-label={MANAGER_EXPERIENCE.FLEET_PULSE_TITLE}
    >
      <div className="border-b border-white/10 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Activity className="h-4 w-4 shrink-0 text-teal-300" aria-hidden />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-300/90">
                {MANAGER_EXPERIENCE.FLEET_PULSE_EYEBROW}
              </p>
              <span className="rounded-full border border-teal-500/40 bg-teal-950/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-200">
                {scoringBadge}
              </span>
            </div>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-white sm:text-xl">
              {MANAGER_EXPERIENCE.FLEET_PULSE_TITLE}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-300">
              {MANAGER_EXPERIENCE.FLEET_PULSE_SUBTITLE}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 tabular-nums text-slate-200">
              <Users className="h-3.5 w-3.5 text-teal-300" aria-hidden />
              {data?.drivers.length ?? 0} drivers
            </span>
            <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 tabular-nums text-slate-200">
              {elevatedCount} elevated
            </span>
            {updatedLabel ? (
              <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-400">
                {isFetching ? "Updating…" : `As of ${updatedLabel} AWST`}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-b border-white/10 px-4 py-2 sm:px-6">
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-6 rounded-sm" style={{ backgroundColor: cellBackground(25) }} />
            Lower
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-6 rounded-sm" style={{ backgroundColor: cellBackground(50) }} />
            Monitor
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-6 rounded-sm" style={{ backgroundColor: cellBackground(75) }} />
            Elevated
          </span>
          <span className="text-slate-500">· Click a row for single-driver TPMA chart</span>
        </div>
      </div>

      {isLoading ? (
        <div className="px-6 py-12 text-center text-sm text-slate-400">Loading fleet pulse…</div>
      ) : !data?.drivers.length ? (
        <div className="px-6 py-12 text-center text-sm text-slate-400">
          {MANAGER_EXPERIENCE.FLEET_PULSE_EMPTY}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex min-w-[640px] border-b border-white/10 bg-slate-900/60">
            <div className="sticky left-0 z-10 w-[9.5rem] shrink-0 border-r border-white/10 px-3 py-2 sm:w-[11rem]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Driver
              </span>
            </div>
            <div className="flex min-w-0 flex-1">
              {data.columnLabels.map((label, i) => (
                <div
                  key={`${label}-${i}`}
                  className={cn(
                    "min-w-[6px] flex-1 truncate px-0 py-2 text-center text-[9px] text-slate-500 sm:min-w-[8px]",
                    i === nowIndex && "font-semibold text-teal-300",
                    labelIndices.includes(i) ? "opacity-100" : "opacity-0 sm:opacity-0"
                  )}
                >
                  {labelIndices.includes(i) ? label : ""}
                </div>
              ))}
            </div>
          </div>

          {data.drivers.map((row, index) => (
            <DriverHeatmapRow
              key={row.driverName}
              row={row}
              nowIndex={nowIndex}
              selected={selectedDriver === row.driverName}
              rank={index + 1}
              onSelect={onSelectDriver}
            />
          ))}
        </div>
      )}

      {data?.disclaimer ? (
        <p className="border-t border-white/10 px-4 py-3 text-[10px] leading-relaxed text-slate-500 sm:px-6">
          {data.disclaimer}
        </p>
      ) : null}
    </section>
  );
}
