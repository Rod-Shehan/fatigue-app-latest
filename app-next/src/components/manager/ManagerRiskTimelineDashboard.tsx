"use client";

import { useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";
import { Activity, MapPin, Radio, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { api } from "@/lib/api";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import { managerMapHref } from "@/lib/manager-map-link";
import type { CameraBlockFeatures } from "@/lib/camera-risk-packet";
import {
  applyQueuedLiveBlocks,
  buildDemoRiskTimelineSeries,
  findCrossoverIntervals,
  findNowBlockStartMs,
  nextDemoLiveBlocks,
  riskPercentToColor,
  RISK_COLOR_THRESHOLDS,
  FATIGUE_RISK_REFERENCES,
  RISK_TIMELINE_CHART_HELP,
  synthesizeRiskNarrative,
  type QueuedLiveBlock,
  type RiskTimelineBlock,
  type RiskTimelineSeries,
} from "@/lib/manager-risk-timeline";
import {
  FRMS_RISK_TIMELINE_CHART_HELP,
  FRMS_TPMA_REFERENCES,
} from "@/lib/frms/tpma-references";

type FeedState = {
  blocks: RiskTimelineBlock[];
  queue: QueuedLiveBlock[];
  online: boolean;
  nowBlockStartMs: number;
};

type FeedAction =
  | { type: "RESET"; series: RiskTimelineSeries }
  | { type: "SET_ONLINE"; online: boolean }
  | { type: "ENQUEUE"; items: QueuedLiveBlock[] }
  | { type: "FLUSH_QUEUE" }
  | { type: "ADVANCE_ONE"; item: QueuedLiveBlock };

function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case "RESET":
      return {
        blocks: action.series.blocks,
        queue: [],
        online: true,
        nowBlockStartMs: action.series.nowBlockStartMs,
      };
    case "SET_ONLINE":
      return { ...state, online: action.online };
    case "ENQUEUE":
      return { ...state, queue: [...state.queue, ...action.items] };
    case "FLUSH_QUEUE": {
      if (state.queue.length === 0) return state;
      return {
        ...state,
        blocks: applyQueuedLiveBlocks(state.blocks, state.queue),
        queue: [],
      };
    }
    case "ADVANCE_ONE":
      return {
        ...state,
        blocks: applyQueuedLiveBlocks(state.blocks, [action.item]),
      };
    default:
      return state;
  }
}

function chartRows(blocks: RiskTimelineBlock[]) {
  return blocks.map((b) => ({
    ...b,
    time: b.label,
    livePct: b.livePct ?? null,
  }));
}

const CHART_THEME = {
  light: {
    grid: "#e2e8f0",
    axis: "#64748b",
    crossoverFill: "#fef3c7",
    crossoverOpacity: 0.4,
    baselineStroke: "#94a3b8",
    nowLine: "#0d9488",
    nowLabel: "#0d9488",
    dotStroke: "#ffffff",
    refDotStroke: "#ffffff",
    tooltipBg: "#ffffff",
    tooltipBorder: "#e2e8f0",
    tooltipColor: "#0f172a",
  },
  dark: {
    grid: "#334155",
    axis: "#94a3b8",
    crossoverFill: "#f59e0b",
    crossoverOpacity: 0.12,
    baselineStroke: "#94a3b8",
    nowLine: "#2dd4bf",
    nowLabel: "#5eead4",
    dotStroke: "#0f172a",
    refDotStroke: "#0f172a",
    tooltipBg: "#1e293b",
    tooltipBorder: "#475569",
    tooltipColor: "#f1f5f9",
  },
} as const;

export function ManagerRiskTimelineDashboard({
  driverName,
  weekStarting,
  demo = true,
  aboveChart,
  autoSelected = false,
}: {
  driverName: string;
  /** Manager focus week — aligns FRMS cache hash with day picker. */
  weekStarting?: string;
  /** Show demo controls when no server blocks exist yet. */
  demo?: boolean;
  /** Scope controls (day picker) rendered directly above the chart. */
  aboveChart?: ReactNode;
  /** Chart driver was picked automatically (highest current fleet risk). */
  autoSelected?: boolean;
}) {
  const { resolved: colorMode } = useTheme();
  const chart = CHART_THEME[colorMode];

  const { data: apiData, isLoading: apiLoading } = useQuery({
    queryKey: ["manager", "risk-timeline", driverName, weekStarting ?? ""],
    queryFn: () => api.manager.riskTimeline({ driverName, weekStarting }),
    enabled: !!driverName,
  });

  const scoringEngine = apiData?.scoring_engine ?? "legacy";
  const usesFrmsHelp = scoringEngine === "frms";
  const chartHelp = usesFrmsHelp ? FRMS_RISK_TIMELINE_CHART_HELP : RISK_TIMELINE_CHART_HELP;
  const chartReferences = usesFrmsHelp ? FRMS_TPMA_REFERENCES : FATIGUE_RISK_REFERENCES;

  const hasServerData =
    (apiData?.block_count ?? 0) > 0 ||
    (apiData?.snapshot_count ?? 0) > 0 ||
    apiData?.scoring_engine === "frms";
  const useDemoData = demo && !hasServerData && !apiLoading;

  const initialSeries = useMemo(
    () => buildDemoRiskTimelineSeries(driverName),
    [driverName]
  );

  const [feed, dispatch] = useReducer(feedReducer, initialSeries, (series) => ({
    blocks: series.blocks,
    queue: [],
    online: true,
    nowBlockStartMs: series.nowBlockStartMs,
  }));

  const [latestCamera, setLatestCamera] = useState<CameraBlockFeatures | undefined>();

  useEffect(() => {
    if (hasServerData && apiData?.series) {
      dispatch({ type: "RESET", series: apiData.series });
      setLatestCamera(apiData.latest_camera ?? undefined);
    } else if (!apiLoading) {
      dispatch({ type: "RESET", series: buildDemoRiskTimelineSeries(driverName) });
      setLatestCamera(undefined);
    }
  }, [driverName, hasServerData, apiData, apiLoading]);

  const rows = useMemo(() => chartRows(feed.blocks), [feed.blocks]);
  const crossovers = useMemo(() => findCrossoverIntervals(feed.blocks), [feed.blocks]);

  const crossoverBands = useMemo(() => {
    return crossovers
      .map((c) => {
        const inRange = feed.blocks.filter(
          (b) => b.blockStartMs >= c.startMs && b.blockStartMs < c.endMs && b.livePct != null
        );
        if (inRange.length === 0) return null;
        return { key: `${c.startMs}`, x1: inRange[0].label, x2: inRange[inRange.length - 1].label };
      })
      .filter(Boolean) as { key: string; x1: string; x2: string }[];
  }, [crossovers, feed.blocks]);

  const latestLiveBlock = useMemo(() => {
    const withLive = feed.blocks.filter((b) => b.livePct != null);
    return withLive[withLive.length - 1] ?? null;
  }, [feed.blocks]);

  const narrative = useMemo(
    () =>
      latestLiveBlock
        ? synthesizeRiskNarrative(latestLiveBlock, { driverName, camera: latestCamera })
        : "Live risk narrative will appear as 15-minute blocks arrive.",
    [latestLiveBlock, driverName, latestCamera]
  );

  const liveStroke = latestLiveBlock?.livePct != null
    ? riskPercentToColor(latestLiveBlock.livePct)
    : "#16a34a";

  const nowLabel = useMemo(() => {
    const now = feed.blocks.find((b) => b.isNow);
    return now?.label ?? formatNowPerth();
  }, [feed.blocks]);

  const deliverBlock = useCallback(
    (item: QueuedLiveBlock) => {
      if (feed.online) {
        dispatch({ type: "ADVANCE_ONE", item });
      } else {
        dispatch({ type: "ENQUEUE", items: [item] });
      }
    },
    [feed.online]
  );

  const advanceOneBlock = useCallback(() => {
    const pending = feed.blocks.filter(
      (b) => b.blockStartMs > feed.nowBlockStartMs && b.livePct == null
    );
    if (pending.length === 0) return;
    const block = pending[0];
    const idx = feed.blocks.indexOf(block);
    const batch = nextDemoLiveBlocks(
      { driverName, timezone: "Australia/Perth", blocks: feed.blocks, nowBlockStartMs: feed.nowBlockStartMs },
      1
    );
    const item = batch[0] ?? {
      blockStartMs: block.blockStartMs,
      livePct: Math.min(100, block.baselinePct + 8 + (idx % 4) * 3),
    };
    deliverBlock(item);
  }, [feed.blocks, feed.nowBlockStartMs, driverName, deliverBlock]);

  const simulateBlackspot = () => {
    dispatch({ type: "SET_ONLINE", online: false });
    const batch = nextDemoLiveBlocks(buildDemoRiskTimelineSeries(driverName), 4);
    dispatch({ type: "ENQUEUE", items: batch });
  };

  const restoreConnection = () => {
    dispatch({ type: "SET_ONLINE", online: true });
    dispatch({ type: "FLUSH_QUEUE" });
  };

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
      aria-label={`Risk timeline for ${driverName}`}
    >
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400" aria-hidden />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                {MANAGER_EXPERIENCE.TIMELINE_TITLE} — {driverName}
              </h3>
              {autoSelected ? (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
                  Auto
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              15-minute blocks across past and planned time. Shows fatigue risk{" "}
              <strong className="font-semibold text-slate-700 dark:text-slate-200">in each block</strong>, centred on{" "}
              <strong className="font-semibold text-slate-700 dark:text-slate-200">right now ({nowLabel} AWST)</strong>.
              Not a compliance score or fleet average.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0 items-center">
            <Link
              href={managerMapHref({ weekStarting, driverName })}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600 transition-colors hover:border-teal-400 hover:text-teal-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-teal-600 dark:hover:text-teal-300"
              title={MANAGER_EXPERIENCE.MAP_LOCATE_DRIVER}
            >
              <MapPin className="h-3 w-3" aria-hidden />
              {MANAGER_EXPERIENCE.TIMELINE_VIEW_ON_MAP}
            </Link>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                hasServerData
                  ? "bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {apiLoading
                ? "Loading…"
                : usesFrmsHelp
                  ? apiData?.frms_cache_status === "stale"
                    ? "TPMA · updating"
                    : "TPMA · server"
                  : hasServerData
                    ? "Camera + server"
                    : "Demo preview"}
            </span>
            {useDemoData ? (
              <>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    feed.online
                      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                      : "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
                  }`}
                >
                  {feed.online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {feed.online ? "Online" : "Blackspot — buffering"}
                </span>
                {feed.queue.length > 0 ? (
                  <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
                    {feed.queue.length} block(s) queued
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {aboveChart ? (
        <div className="border-b border-slate-100 dark:border-slate-800">{aboveChart}</div>
      ) : null}

      <div className="px-2 py-4 sm:px-4">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: chart.axis }}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: chart.axis }}
                tickFormatter={(v) => `${v}%`}
                width={36}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  value == null ? "—" : `${value}%`,
                  name === "baselinePct" ? "Expected (baseline)" : "Live risk",
                ]}
                labelFormatter={(label) => `Block ${label} AWST`}
                contentStyle={{
                  fontSize: 12,
                  backgroundColor: chart.tooltipBg,
                  borderColor: chart.tooltipBorder,
                  color: chart.tooltipColor,
                }}
              />
              {crossoverBands.map((band) => (
                <ReferenceArea
                  key={band.key}
                  x1={band.x1}
                  x2={band.x2}
                  fill={chart.crossoverFill}
                  fillOpacity={chart.crossoverOpacity}
                  strokeOpacity={0}
                />
              ))}
              <ReferenceLine
                x={nowLabel}
                stroke={chart.nowLine}
                strokeDasharray="4 4"
                label={{ value: "Now", position: "top", fill: chart.nowLabel, fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey="baselinePct"
                name="baselinePct"
                stroke={chart.baselineStroke}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="livePct"
                name="livePct"
                stroke={liveStroke}
                strokeWidth={2.5}
                connectNulls={false}
                dot={(props) => {
                  const { cx, cy, payload } = props as {
                    cx?: number;
                    cy?: number;
                    payload?: { livePct?: number | null; isNow?: boolean };
                  };
                  if (cx == null || cy == null || payload?.livePct == null) return <g />;
                  const fill = riskPercentToColor(payload.livePct);
                  return (
                    <circle
                      key={`${cx}-${cy}`}
                      cx={cx}
                      cy={cy}
                      r={payload.isNow ? 5 : 3}
                      fill={fill}
                      stroke={payload.isNow ? chart.nowLine : chart.dotStroke}
                      strokeWidth={payload.isNow ? 2 : 1}
                    />
                  );
                }}
                isAnimationActive={false}
              />
              {latestLiveBlock && latestLiveBlock.livePct != null &&
              latestLiveBlock.livePct > latestLiveBlock.baselinePct ? (
                <ReferenceDot
                  x={latestLiveBlock.label}
                  y={latestLiveBlock.livePct}
                  r={6}
                  fill="#d97706"
                  stroke={chart.refDotStroke}
                  strokeWidth={2}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 flex flex-wrap gap-3 px-2 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1" title={chartHelp.baseline.summary}>
            <span className="h-0.5 w-4 bg-slate-400" aria-hidden /> Expected baseline
            <span className="text-slate-400 dark:text-slate-500">(diary-only expected %)</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-4 bg-emerald-600" aria-hidden /> Live &lt; {RISK_COLOR_THRESHOLDS.amber}%
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-4 bg-amber-600" aria-hidden /> {RISK_COLOR_THRESHOLDS.amber}–{RISK_COLOR_THRESHOLDS.red - 1}%
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-4 bg-red-600" aria-hidden /> ≥ {RISK_COLOR_THRESHOLDS.red}%
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              className="h-3 w-3 rounded-sm bg-amber-100 border border-amber-200 dark:bg-amber-500/20 dark:border-amber-600/40"
              aria-hidden
            />{" "}
            Live above baseline
          </span>
        </div>

        <details className="mx-2 mt-3 rounded-lg border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/50">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            How this chart is calculated
          </summary>
          <div className="space-y-3 border-t border-slate-200 px-3 py-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:text-slate-300">
            <p>{chartHelp.intro}</p>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {chartHelp.baseline.title}
              </p>
              <p className="mt-1">{chartHelp.baseline.summary}</p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                {chartHelp.baseline.factors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-1.5">{chartHelp.baseline.mapping}</p>
              <p className="mt-1 text-slate-500 dark:text-slate-400">{chartHelp.baseline.horizon}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {chartHelp.live.title}
              </p>
              <p className="mt-1">{chartHelp.live.summary}</p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                {chartHelp.live.factors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-1 text-slate-500 dark:text-slate-400">{chartHelp.live.horizon}</p>
            </div>
            <p className="text-slate-500 dark:text-slate-400">{chartHelp.shaded}</p>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                References ({usesFrmsHelp ? "TPMA · frms-py-1" : "model v1"})
              </p>
              <p className="mt-1 text-slate-500 dark:text-slate-400">{chartHelp.referencesNote}</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] text-slate-500 dark:text-slate-400">
                {chartReferences.map((ref) => (
                  <li key={ref.id}>{ref.citation}</li>
                ))}
              </ul>
            </div>
            {useDemoData ? (
              <p className="rounded-md border border-dashed border-slate-300 bg-white/60 px-2 py-1.5 text-slate-500 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
                <strong className="font-semibold text-slate-600 dark:text-slate-300">Demo preview:</strong>{" "}
                {usesFrmsHelp
                  ? "legacy sawtooth demo until FRMS snapshots are cached for this driver."
                  : "sample diary patterns until real camera blocks are stored on the server."}
              </p>
            ) : null}
          </div>
        </details>
      </div>

      <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
        <div className="flex items-start gap-2">
          <Radio className="mt-0.5 h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400" aria-hidden />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Live readout
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-800 dark:text-slate-100">{narrative}</p>
          </div>
        </div>
      </div>

      {useDemoData ? (
        <div className="border-t border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40 sm:px-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Demo controls (hidden when camera blocks exist on server)
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={advanceOneBlock}>
              Add next 15-min block
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={simulateBlackspot} disabled={!feed.online}>
              Simulate blackspot
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={restoreConnection} disabled={feed.online}>
              Restore link &amp; flush
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => dispatch({ type: "RESET", series: buildDemoRiskTimelineSeries(driverName) })}
            >
              Reset demo
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatNowPerth(): string {
  return new Date(findNowBlockStartMs()).toLocaleTimeString("en-AU", {
    timeZone: "Australia/Perth",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
