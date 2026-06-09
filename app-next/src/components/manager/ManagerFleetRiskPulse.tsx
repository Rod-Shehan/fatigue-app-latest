"use client";

import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  HeartHandshake,
  Radio,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import {
  buildFleetPriorityQueue,
  fleetElevatedNowCount,
  fleetHeatmapLabelIndices,
  fleetWorstNowDriver,
  findFleetNowIndex,
  type FleetDriverRiskRow,
  type FleetPriorityItem,
} from "@/lib/frms/fleet-risk-timeline";
import { RISK_COLOR_THRESHOLDS, riskPercentToColor } from "@/lib/manager-risk-timeline";
import { cn } from "@/lib/utils";

function cellBackground(pct: number): string {
  const base = riskPercentToColor(pct);
  if (pct >= RISK_COLOR_THRESHOLDS.red) return `${base}cc`;
  if (pct >= RISK_COLOR_THRESHOLDS.amber) return `${base}99`;
  return `${base}44`;
}

const SEVERITY_DOT: Record<FleetPriorityItem["severity"], string> = {
  critical: "bg-red-500",
  elevated: "bg-amber-500",
  monitor: "bg-sky-500",
  clear: "bg-emerald-500",
};

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
        "group flex w-full min-w-0 items-stretch gap-0 border-b border-white/5 text-left transition-colors",
        selected ? "bg-teal-900/50" : "hover:bg-white/5",
        rank <= 3 && !selected && "bg-rose-950/20"
      )}
    >
      <div className="sticky left-0 z-10 flex w-[8.5rem] shrink-0 items-center gap-2 border-r border-white/10 bg-inherit px-2 py-2 sm:w-[10rem] sm:px-3">
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
            rank <= 3 ? "bg-rose-900/80 text-rose-100" : "bg-white/10 text-slate-400"
          )}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-white">{row.driverName}</p>
          <p className="text-[10px] tabular-nums text-slate-400">
            {row.nowPct ?? "—"}% now
          </p>
        </div>
      </div>
      <div className="flex min-w-0 flex-1">
        {row.cells.map((cell, i) => (
          <div
            key={cell.blockStartMs}
            title={`${row.driverName} · ${cell.label} · ${cell.pct}%`}
            className={cn(
              "h-9 min-w-[5px] flex-1 sm:min-w-[7px]",
              i === nowIndex && "ring-1 ring-inset ring-teal-400"
            )}
            style={{ backgroundColor: cellBackground(cell.pct) }}
          />
        ))}
      </div>
    </button>
  );
}

function PriorityQueueItem({
  item,
  selected,
  onSelect,
}: {
  item: FleetPriorityItem;
  selected: boolean;
  onSelect: (name: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.driverName)}
      className={cn(
        "flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
        selected
          ? "border-teal-500/50 bg-teal-950/40"
          : "border-white/5 bg-white/5 hover:border-white/15 hover:bg-white/10"
      )}
    >
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", SEVERITY_DOT[item.severity])} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-xs font-semibold text-white">{item.driverName}</p>
          <span className="shrink-0 text-xs font-bold tabular-nums text-teal-200">
            {item.nowPct ?? "—"}%
          </span>
        </div>
        <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{item.reason}</p>
      </div>
      <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden />
    </button>
  );
}

function KpiChip({
  label,
  value,
  icon,
  onClick,
  highlight,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  onClick?: () => void;
  highlight?: boolean;
}) {
  const className = cn(
    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors",
    highlight
      ? "border-rose-500/40 bg-rose-950/40 text-rose-100"
      : "border-white/10 bg-white/5 text-slate-200",
    onClick && "cursor-pointer hover:border-teal-500/40 hover:bg-teal-950/30"
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {icon}
        <span className="flex flex-col">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
          <span className="text-xs font-semibold tabular-nums">{value}</span>
        </span>
      </button>
    );
  }

  return (
    <span className={className}>
      {icon}
      <span className="flex flex-col">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="text-xs font-semibold tabular-nums">{value}</span>
      </span>
    </span>
  );
}

export function ManagerFleetRiskPulse({
  weekStarting,
  driverNames,
  selectedDriver,
  onSelectDriver,
  checkInCount = 0,
  onScrollToCheckIns,
}: {
  weekStarting: string;
  driverNames: string[];
  selectedDriver?: string;
  onSelectDriver: (name: string) => void;
  checkInCount?: number;
  onScrollToCheckIns?: () => void;
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

  const priorityQueue = useMemo(
    () => buildFleetPriorityQueue(data?.drivers ?? []),
    [data?.drivers]
  );

  const worstNow = useMemo(() => fleetWorstNowDriver(data?.drivers ?? []), [data?.drivers]);
  const elevatedNow = useMemo(() => fleetElevatedNowCount(data?.drivers ?? []), [data?.drivers]);

  const scoringBadge =
    data?.scoring_engine === "frms"
      ? "TPMA · fleet"
      : data?.scoring_engine === "mixed"
        ? "TPMA · partial"
        : "Demo / legacy";

  const tpmaLiveLabel =
    data?.scoring_engine === "frms" || data?.scoring_engine === "mixed" ? "Server" : "Legacy";

  const updatedLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Australia/Perth",
      })
    : null;

  return (
    <section
      className="mb-8 overflow-hidden rounded-2xl border border-teal-200/90 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white shadow-xl dark:border-teal-800/60"
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
            </div>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-white sm:text-xl">
              {MANAGER_EXPERIENCE.FLEET_PULSE_TITLE}
            </h2>
          </div>
          {updatedLabel ? (
            <span className="text-[10px] text-slate-500">
              {isFetching ? "Updating…" : `${updatedLabel} AWST`}
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <KpiChip
            label={MANAGER_EXPERIENCE.FLEET_KPI_WORST_NOW}
            value={
              worstNow ? `${worstNow.driverName} · ${worstNow.nowPct}%` : "—"
            }
            icon={<TrendingUp className="h-4 w-4 shrink-0 text-rose-400" aria-hidden />}
            highlight={!!worstNow && worstNow.nowPct >= RISK_COLOR_THRESHOLDS.amber}
            onClick={worstNow ? () => onSelectDriver(worstNow.driverName) : undefined}
          />
          <KpiChip
            label={MANAGER_EXPERIENCE.FLEET_KPI_ELEVATED_NOW}
            value={`${elevatedNow} driver${elevatedNow === 1 ? "" : "s"}`}
            icon={<AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />}
            highlight={elevatedNow > 0}
          />
          <KpiChip
            label={MANAGER_EXPERIENCE.FLEET_KPI_TPMA_LIVE}
            value={`${scoringBadge} · ${tpmaLiveLabel}`}
            icon={<Radio className="h-4 w-4 shrink-0 text-teal-400" aria-hidden />}
          />
          <KpiChip
            label={MANAGER_EXPERIENCE.FLEET_KPI_CHECK_INS}
            value={`${checkInCount} due`}
            icon={<HeartHandshake className="h-4 w-4 shrink-0 text-violet-300" aria-hidden />}
            highlight={checkInCount > 0}
            onClick={checkInCount > 0 ? onScrollToCheckIns : undefined}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="px-6 py-12 text-center text-sm text-slate-400">Loading fleet pulse…</div>
      ) : !data?.drivers.length ? (
        <div className="px-6 py-12 text-center text-sm text-slate-400">
          {MANAGER_EXPERIENCE.FLEET_PULSE_EMPTY}
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row">
          <div className="min-w-0 flex-[7] overflow-x-auto border-b border-white/10 lg:border-b-0 lg:border-r">
            <div className="border-b border-white/10 bg-slate-900/60 px-3 py-2 sm:px-4">
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
              </div>
            </div>

            <div className="flex min-w-[520px] border-b border-white/10 bg-slate-900/40">
              <div className="sticky left-0 z-10 w-[8.5rem] shrink-0 border-r border-white/10 px-2 py-2 sm:w-[10rem] sm:px-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Driver
                </span>
              </div>
              <div className="flex min-w-0 flex-1">
                {data.columnLabels.map((label, i) => (
                  <div
                    key={`${label}-${i}`}
                    className={cn(
                      "min-w-[5px] flex-1 py-2 text-center text-[9px] text-slate-500 sm:min-w-[7px]",
                      i === nowIndex && "font-semibold text-teal-300",
                      labelIndices.includes(i) ? "opacity-100" : "opacity-0"
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

          <aside className="flex flex-[3] flex-col bg-slate-950/50 lg:max-w-[18rem] xl:max-w-xs">
            <div className="border-b border-white/10 px-4 py-3">
              <p className="text-xs font-semibold text-white">{MANAGER_EXPERIENCE.FLEET_PRIORITY_TITLE}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
                {MANAGER_EXPERIENCE.FLEET_PRIORITY_HINT}
              </p>
            </div>
            <div className="flex max-h-[280px] flex-col gap-2 overflow-y-auto p-3 lg:max-h-none lg:flex-1">
              {priorityQueue.length === 0 ? (
                <p className="text-xs text-slate-500">{MANAGER_EXPERIENCE.FLEET_PRIORITY_EMPTY}</p>
              ) : (
                priorityQueue.map((item) => (
                  <PriorityQueueItem
                    key={item.driverName}
                    item={item}
                    selected={selectedDriver === item.driverName}
                    onSelect={onSelectDriver}
                  />
                ))
              )}
            </div>
          </aside>
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
