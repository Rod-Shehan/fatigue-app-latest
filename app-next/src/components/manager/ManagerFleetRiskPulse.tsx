"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  HeartHandshake,
  MapPin,
  Radio,
  TrendingUp,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import {
  buildFleetPriorityQueue,
  FLEET_ACTION_THRESHOLD_PCT,
  fleetElevatedNowCount,
  fleetHeatmapLabelIndices,
  fleetWorstNowDriver,
  findFleetNowIndex,
  type FleetDriverRiskRow,
  type FleetPriorityItem,
} from "@/lib/frms/fleet-risk-timeline";
import { RISK_COLOR_THRESHOLDS, riskPercentToColor } from "@/lib/manager-risk-timeline";
import { managerMapHref } from "@/lib/manager-map-link";
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
        "group flex w-full min-w-0 items-stretch gap-0 border-b border-slate-200 text-left transition-colors dark:border-white/5",
        selected ? "bg-teal-50 dark:bg-teal-900/50" : "hover:bg-slate-50 dark:hover:bg-white/5",
        rank <= 3 && !selected && "bg-rose-50/90 dark:bg-rose-950/20"
      )}
    >
      <div className="sticky left-0 z-10 flex w-[8.5rem] shrink-0 items-center gap-2 border-r border-slate-200 bg-inherit px-2 py-2 sm:w-[10rem] sm:px-3 dark:border-white/10">
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
            rank <= 3
              ? "bg-rose-100 text-rose-800 dark:bg-rose-900/80 dark:text-rose-100"
              : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
          )}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{row.driverName}</p>
          <p className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
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
              i === nowIndex && "ring-1 ring-inset ring-teal-500 dark:ring-teal-400"
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
  weekStarting,
  mapDayIndex,
  selected,
  onSelect,
}: {
  item: FleetPriorityItem;
  weekStarting: string;
  mapDayIndex?: number;
  selected: boolean;
  onSelect: (name: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-stretch gap-1 rounded-lg border transition-colors",
        selected
          ? "border-teal-300 bg-teal-50 dark:border-teal-500/50 dark:bg-teal-950/40"
          : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100 dark:border-white/5 dark:bg-white/5 dark:hover:border-white/15 dark:hover:bg-white/10"
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(item.driverName)}
        className="flex min-w-0 flex-1 items-start gap-2 px-2.5 py-2 text-left"
      >
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", SEVERITY_DOT[item.severity])} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{item.driverName}</p>
            <span className="shrink-0 text-xs font-bold tabular-nums text-teal-700 dark:text-teal-200">
              {item.nowPct ?? "—"}%
            </span>
          </div>
          <p className="mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">{item.reason}</p>
        </div>
        <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-600" aria-hidden />
      </button>
      <Link
        href={managerMapHref({ weekStarting, driverName: item.driverName, dayIndex: mapDayIndex })}
        className="flex shrink-0 items-center rounded-r-lg border-l border-slate-200 px-2 text-slate-500 transition-colors hover:bg-teal-50 hover:text-teal-700 dark:border-white/5 dark:hover:bg-teal-950/50 dark:hover:text-teal-300"
        title={`${MANAGER_EXPERIENCE.MAP_LOCATE_DRIVER} — ${item.driverName}`}
        aria-label={`${MANAGER_EXPERIENCE.MAP_LOCATE_DRIVER} — ${item.driverName}`}
      >
        <MapPin className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

function KpiChip({
  label,
  value,
  icon,
  onClick,
  highlight,
  hint,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  onClick?: () => void;
  highlight?: boolean;
  hint?: string;
}) {
  const className = cn(
    "group/kpi relative inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors",
    highlight
      ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-100"
      : "border-slate-200 bg-white text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200",
    onClick &&
      "cursor-pointer hover:border-teal-400 hover:bg-teal-50 dark:hover:border-teal-500/40 dark:hover:bg-teal-950/30",
    hint && !onClick && "cursor-help"
  );

  const body = (
    <>
      {icon}
      <span className="flex flex-col">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <span className="text-xs font-semibold tabular-nums">{value}</span>
      </span>
      {hint ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute top-[calc(100%+6px)] left-1/2 z-50 w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-normal normal-case leading-snug tracking-normal text-slate-600 opacity-0 shadow-lg transition-opacity duration-150 group-hover/kpi:opacity-100 group-focus-within/kpi:opacity-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          {hint}
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} title={hint}>
        {body}
      </button>
    );
  }

  return (
    <span className={className} tabIndex={hint ? 0 : undefined} title={hint}>
      {body}
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
  mapDayIndex,
}: {
  weekStarting: string;
  driverNames: string[];
  selectedDriver?: string;
  onSelectDriver: (name: string) => void;
  checkInCount?: number;
  onScrollToCheckIns?: () => void;
  /** Selected day (0=Sun) — rides along on map links so Back restores it. */
  mapDayIndex?: number;
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

  const allDrivers = data?.all_drivers ?? data?.drivers ?? [];
  const actionableDrivers = data?.drivers ?? [];
  const columnLabels = data?.columnLabels ?? [];
  const summary = data?.fleet_summary;

  const labelIndices = useMemo(
    () => fleetHeatmapLabelIndices(columnLabels.length),
    [columnLabels.length]
  );

  const nowIndex = useMemo(() => {
    const first = actionableDrivers[0]?.cells ?? [];
    return findFleetNowIndex(first, data?.nowBlockStartMs ?? 0);
  }, [actionableDrivers, data?.nowBlockStartMs]);

  const priorityQueue = useMemo(
    () => buildFleetPriorityQueue(actionableDrivers),
    [actionableDrivers]
  );

  const worstNow = useMemo(() => fleetWorstNowDriver(allDrivers), [allDrivers]);
  const elevatedNow = useMemo(() => fleetElevatedNowCount(allDrivers), [allDrivers]);
  const totalInScope = summary?.total_in_scope ?? allDrivers.length;
  const actionableCount = summary?.actionable_count ?? actionableDrivers.length;
  const thresholdPct = summary?.action_threshold_pct ?? FLEET_ACTION_THRESHOLD_PCT;
  const allBelowThreshold =
    totalInScope > 0 && actionableCount === 0 && !isLoading;

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
      className="mb-8 overflow-visible rounded-2xl border border-teal-200/90 bg-white text-slate-900 shadow-lg dark:border-teal-800/60 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-teal-950 dark:text-white dark:shadow-xl"
      aria-label={MANAGER_EXPERIENCE.FLEET_PULSE_TITLE}
    >
      <div className="border-b border-slate-200 px-4 py-4 sm:px-6 dark:border-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Activity className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-300" aria-hidden />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700 dark:text-teal-300/90">
                {MANAGER_EXPERIENCE.FLEET_PULSE_EYEBROW}
              </p>
            </div>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl dark:text-white">
              {MANAGER_EXPERIENCE.FLEET_PULSE_TITLE}
            </h2>
          </div>
          {updatedLabel ? (
            <span className="text-[10px] text-slate-500 dark:text-slate-500">
              {isFetching ? "Updating…" : `${updatedLabel} AWST`}
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <KpiChip
            label={MANAGER_EXPERIENCE.FLEET_KPI_IN_SCOPE}
            value={`${totalInScope} driver${totalInScope === 1 ? "" : "s"}`}
            icon={<Users className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />}
            hint={MANAGER_EXPERIENCE.FLEET_KPI_IN_SCOPE_HINT}
          />
          <KpiChip
            label={MANAGER_EXPERIENCE.FLEET_KPI_ACTIONABLE}
            value={`${actionableCount} above ${thresholdPct}%`}
            icon={<AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />}
            highlight={actionableCount > 0}
            hint={MANAGER_EXPERIENCE.FLEET_KPI_ACTIONABLE_HINT}
          />
          <KpiChip
            label={MANAGER_EXPERIENCE.FLEET_KPI_WORST_NOW}
            value={
              worstNow ? `${worstNow.driverName} · ${worstNow.nowPct}%` : "—"
            }
            icon={<TrendingUp className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />}
            highlight={!!worstNow && worstNow.nowPct >= FLEET_ACTION_THRESHOLD_PCT}
            onClick={worstNow ? () => onSelectDriver(worstNow.driverName) : undefined}
            hint={MANAGER_EXPERIENCE.FLEET_KPI_WORST_NOW_HINT}
          />
          <KpiChip
            label={MANAGER_EXPERIENCE.FLEET_KPI_ELEVATED_NOW}
            value={`${elevatedNow} elevated now`}
            icon={<TrendingUp className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />}
            highlight={elevatedNow > 0}
            hint={MANAGER_EXPERIENCE.FLEET_KPI_ELEVATED_NOW_HINT}
          />
          <KpiChip
            label={MANAGER_EXPERIENCE.FLEET_KPI_TPMA_LIVE}
            value={`${scoringBadge} · ${tpmaLiveLabel}`}
            icon={<Radio className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />}
            hint={MANAGER_EXPERIENCE.FLEET_KPI_TPMA_LIVE_HINT}
          />
          <KpiChip
            label={MANAGER_EXPERIENCE.FLEET_KPI_CHECK_INS}
            value={`${checkInCount} due`}
            icon={<HeartHandshake className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden />}
            highlight={checkInCount > 0}
            onClick={checkInCount > 0 ? onScrollToCheckIns : undefined}
            hint={MANAGER_EXPERIENCE.FLEET_KPI_CHECK_INS_HINT}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading fleet pulse…</div>
      ) : totalInScope === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
          {MANAGER_EXPERIENCE.FLEET_PULSE_EMPTY}
        </div>
      ) : allBelowThreshold ? (
        <div className="flex flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-8 w-8 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-100">
                {MANAGER_EXPERIENCE.FLEET_PRIORITY_ALL_CLEAR}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {MANAGER_EXPERIENCE.FLEET_ALL_CLEAR}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
                {MANAGER_EXPERIENCE.FLEET_ACTIONABLE_SUMMARY(0, totalInScope, thresholdPct)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {summary ? (
            <p className="border-b border-slate-200 px-4 py-2 text-[11px] text-slate-500 sm:px-6 dark:border-white/10 dark:text-slate-400">
              {MANAGER_EXPERIENCE.FLEET_ACTIONABLE_SUMMARY(
                summary.actionable_count,
                summary.total_in_scope,
                summary.action_threshold_pct
              )}
              {summary.below_threshold_count > 0
                ? ` · ${summary.below_threshold_count} below threshold (hidden)`
                : ""}
            </p>
          ) : null}
        <div className="flex flex-col lg:flex-row">
          <div className="min-w-0 flex-[7] overflow-x-auto border-b border-slate-200 lg:border-b-0 lg:border-r dark:border-white/10">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 sm:px-4 dark:border-white/10 dark:bg-slate-900/60">
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-600 dark:text-slate-400">
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

            <div className="flex min-w-[520px] border-b border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-slate-900/40">
              <div className="sticky left-0 z-10 w-[8.5rem] shrink-0 border-r border-slate-200 px-2 py-2 sm:w-[10rem] sm:px-3 dark:border-white/10">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Driver
                </span>
              </div>
              <div className="flex min-w-0 flex-1">
                {columnLabels.map((label, i) => (
                  <div
                    key={`${label}-${i}`}
                    className={cn(
                      "min-w-[5px] flex-1 py-2 text-center text-[9px] text-slate-500 sm:min-w-[7px]",
                      i === nowIndex && "font-semibold text-teal-600 dark:text-teal-300",
                      labelIndices.includes(i) ? "opacity-100" : "opacity-0"
                    )}
                  >
                    {labelIndices.includes(i) ? label : ""}
                  </div>
                ))}
              </div>
            </div>

            {actionableDrivers.map((row, index) => (
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

          <aside className="flex flex-[3] flex-col bg-slate-50 lg:max-w-[18rem] xl:max-w-xs dark:bg-slate-950/50">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">{MANAGER_EXPERIENCE.FLEET_PRIORITY_TITLE}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                {MANAGER_EXPERIENCE.FLEET_PRIORITY_HINT}
              </p>
            </div>
            <div className="flex max-h-[280px] flex-col gap-2 overflow-y-auto p-3 lg:max-h-none lg:flex-1">
              {priorityQueue.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-500">{MANAGER_EXPERIENCE.FLEET_PRIORITY_EMPTY}</p>
              ) : (
                priorityQueue.map((item) => (
                  <PriorityQueueItem
                    key={item.driverName}
                    item={item}
                    weekStarting={weekStarting}
                    mapDayIndex={mapDayIndex}
                    selected={selectedDriver === item.driverName}
                    onSelect={onSelectDriver}
                  />
                ))
              )}
            </div>
          </aside>
        </div>
        </>
      )}

      {data?.disclaimer ? (
        <p className="border-t border-slate-200 px-4 py-3 text-[10px] leading-relaxed text-slate-500 sm:px-6 dark:border-white/10 dark:text-slate-500">
          {data.disclaimer}
        </p>
      ) : null}
    </section>
  );
}
