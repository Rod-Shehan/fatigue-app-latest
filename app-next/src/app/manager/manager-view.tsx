"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ManagerSubnav } from "@/components/manager/ManagerSubnav";
import { ManagerReferencePanel } from "@/components/manager/ManagerReferencePanel";
import { REGULATORY_REQUIREMENTS_REFERENCE } from "@/lib/manager-risk-reference";
import { PROSPECTIVE_RISK_REFERENCE } from "@/lib/manager-prospective-risk-reference";
import { ManagerAssuranceSignals, type AssuranceLine } from "@/components/manager/ManagerAssuranceSignals";
import type { ComplianceFixRoute } from "@/lib/compliance-fix-routes";
import { ManagerAttentionPanel } from "@/components/manager/ManagerAttentionPanel";
import { ManagerDriverRegister } from "@/components/manager/ManagerDriverRegister";
import { ManagerRiskTimelineDashboard } from "@/components/manager/ManagerRiskTimelineDashboard";
import { ManagerFleetRiskPulse } from "@/components/manager/ManagerFleetRiskPulse";
import { ManagerRiskScopeBar } from "@/components/manager/ManagerRiskScopeBar";
import { ManagerArchiveAccessControls } from "@/components/manager/ManagerArchiveAccessControls";
import { HOT_WINDOW_ALL_LIVE, isWeekStartingInHotWindow } from "@/lib/hot-cold-records";
import { pickHighestCurrentRiskDriver } from "@/lib/frms/fleet-risk-timeline";
import { findNowBlockStartMs, RISK_BLOCK_MINUTES } from "@/lib/manager-risk-timeline";
import type { ShiftLaneDayCoverage } from "@/lib/manager-risk-shift-lane";
import { buildShiftLanePlanContext } from "@/lib/manager-shift-lane-plans";
import { deriveDaysWithRollover, resolveOpenActivityBeforeFirstDay } from "@/components/fatigue/EventLogger";
import { Declared24hRestsField } from "@/components/fatigue/Declared24hRestsField";
import { sheetDayYmdFromIndex } from "@/lib/route-plan";
import { getPreviousWeekSunday, getRegulatoryTodayYmd, isPastRegulatoryWeek } from "@/lib/weeks";
import { getSheetOwnerEventsInOrder } from "@/lib/rolling-events";
import { isSheetOwnedByDriver } from "@/lib/sheet-ownership";
import { ManagerDomainSection } from "@/components/manager/ManagerDomainSection";
import { ManagerDomainsOverview } from "@/components/manager/ManagerDomainsOverview";
import { MANAGER_EXPERIENCE, MANAGER_PAGE_SHELL } from "@/lib/manager-experience";
import {
  declared24hRestsFromSheet,
  declaredRestRangeKeys,
  getDeclared24hRestRequirementFromSheets,
  resolveDeclared24hRestUiFieldCount,
  seedSoftResetRangeIntoDeclaredRests,
  softResetFieldsFromDeclaredRests,
  type Declared24hRestFields,
  type Declared24hRestKey,
} from "@/lib/declared-24h-rests";
import { isoToPerthYmd } from "@/lib/last-24h-break-range";
import {
  buildManagerDomainKpis,
  countUnsignedSheetsForWeek,
} from "@/lib/manager-dashboard-kpis";
import {
  buildDriverRegister,
  buildGlanceBadges,
  type RiskLineKind,
} from "@/lib/manager-risk-scoring";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type DayData, type FatigueSheet, type SheetUpdatePayload } from "@/lib/api";
import { updateSheetOfflineFirst } from "@/lib/offline-api";
import { MANAGER_PAST_WEEK_AMEND_HINT, SHEET_ATTESTATION_WORKFLOW } from "@/lib/product-copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { signOut } from "next-auth/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Save,
  Loader2,
  CheckCircle2,
  FileEdit,
  Trash2,
  LogOut,
} from "lucide-react";
import {
  ManagerMonthCalendar,
  parseYMD,
  startOfWeekSunday,
  toYMD,
} from "@/app/manager/manager-month-calendar";
import type { ManagerComplianceItem } from "@/lib/api";
import { getEventsInTimeOrder, getLastShiftEndTime, getNonWorkHoursSinceLastShiftEnd } from "@/lib/rolling-events";
import { getBreakDueByTime } from "@/lib/five-hour-break-rule";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatWeekLabel(weekStarting: string): string {
  return new Date(weekStarting + "T12:00:00").toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const LAST_SHEET_KEY = "fatigue-last-sheet-id";

function formatSheetLabel(sheet: FatigueSheet): string {
  const driver = sheet.driver_name || "Draft";
  const week = sheet.week_starting
    ? new Date(sheet.week_starting + "T12:00:00").toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
  return `${driver} — week of ${week}`;
}

type RiskLine = {
  sheetId: string;
  driver: string;
  kind: RiskLineKind;
  detail: string;
};

function formatTimeHm(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function assuranceLinesForWeek(
  items: ManagerComplianceItem[] | undefined,
  weekStarting: string
): AssuranceLine[] {
  if (!items?.length || !weekStarting) return [];
  const filtered = items.filter((i) => i.week_starting === weekStarting);
  const lines: AssuranceLine[] = [];
  for (const item of filtered) {
    const badges = buildGlanceBadges(item);
    for (const r of item.results) {
      if (r.type === "violation") {
        lines.push({
          sheetId: item.sheetId,
          driver: item.driver_name,
          day: r.day,
          message: r.message,
          badges,
        });
      }
    }
  }
  return lines;
}

function formatDayDateLabel(weekStarting: string, dayIndex: number): string {
  if (!weekStarting) return DAY_LABELS[dayIndex] ?? `D${dayIndex + 1}`;
  const d = new Date(weekStarting + "T12:00:00");
  d.setDate(d.getDate() + dayIndex);
  const day = DAY_LABELS[dayIndex] ?? `D${dayIndex + 1}`;
  const date = d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  return `${day} ${date}`;
}

/** True if this day column has any logged data (events, rego, times, etc.). */
function dayHasActivity(day: DayData | undefined): boolean {
  if (!day || typeof day !== "object") return false;
  if (typeof day.truck_rego === "string" && day.truck_rego.trim()) return true;
  if (typeof day.destination === "string" && day.destination.trim()) return true;
  if (typeof day.start_location === "string" && day.start_location.trim()) return true;
  if (Array.isArray(day.events) && day.events.length > 0) return true;
  if (Array.isArray(day.work_time) && day.work_time.some(Boolean)) return true;
  if (Array.isArray(day.breaks) && day.breaks.some(Boolean)) return true;
  if (Array.isArray(day.non_work) && day.non_work.some(Boolean)) return true;
  if (day.start_kms != null || day.end_kms != null) return true;
  return false;
}

export function ManagerView() {
  const queryClient = useQueryClient();
  const [selectedSheetId, setSelectedSheetId] = useState<string>("");
  const [showAmendDialog, setShowAmendDialog] = useState(false);
  const [amendmentReason, setAmendmentReason] = useState("");
  const [activeWeekStarting, setActiveWeekStarting] = useState<string>(() =>
    toYMD(startOfWeekSunday(new Date()))
  );
  const [activeDayIndex, setActiveDayIndex] = useState<number>(new Date().getDay());
  /** Driver filter: exact name from dropdown, or "" = all */
  const [selectedDriverFilter, setSelectedDriverFilter] = useState("");
  /** Rego filter: exact value from selected day, or "" = all */
  const [selectedRegoFilter, setSelectedRegoFilter] = useState("");
  /** When false, chart driver follows highest current fleet risk. */
  const [driverPickManual, setDriverPickManual] = useState(false);
  const [filterNeedsAttention, setFilterNeedsAttention] = useState(false);
  const [filterRecordGaps, setFilterRecordGaps] = useState(false);
  const [filterUnsigned, setFilterUnsigned] = useState(false);
  const [filterNext24, setFilterNext24] = useState(false);
  const [calView, setCalView] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });

  useEffect(() => {
    try {
      const id = sessionStorage.getItem(LAST_SHEET_KEY);
      if (id) setSelectedSheetId(id);
    } catch {
      /* ignore */
    }
  }, []);

  /** Set when scope was just restored from the URL — skips one auto-reset of the manual driver pick. */
  const restoredScopeRef = useRef(false);

  // Restore scope from URL (?week=&day=&driver=) so a round trip to the
  // Event Tracker (or a shared link) lands back on the same context.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const week = sp.get("week");
    const day = sp.get("day");
    const driver = sp.get("driver");
    if (week && /^\d{4}-\d{2}-\d{2}$/.test(week)) setActiveWeekStarting(week);
    if (day != null) {
      const idx = Number(day);
      if (Number.isInteger(idx) && idx >= 0 && idx <= 6) setActiveDayIndex(idx);
    }
    if (driver?.trim()) {
      setSelectedDriverFilter(driver.trim());
      setDriverPickManual(true);
      restoredScopeRef.current = true;
    }
  }, []);

  // Reflect scope in the URL (replace, no history spam) so back-navigation
  // and map deep links can restore exactly what the manager was looking at.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (activeWeekStarting) sp.set("week", activeWeekStarting);
    sp.set("day", String(activeDayIndex));
    if (driverPickManual && selectedDriverFilter) sp.set("driver", selectedDriverFilter);
    window.history.replaceState(null, "", `${window.location.pathname}?${sp.toString()}`);
  }, [activeWeekStarting, activeDayIndex, driverPickManual, selectedDriverFilter]);

  const [form, setForm] = useState<{
    last_24h_break: string;
    last_24h_break_start: string;
    last_24h_break_end: string;
    last_24h_rest_1: string;
    last_24h_rest_2: string;
    last_24h_rest_3: string;
    last_24h_rest_4: string;
    last_24h_rest_1_start: string;
    last_24h_rest_1_end: string;
    last_24h_rest_2_start: string;
    last_24h_rest_2_end: string;
    last_24h_rest_3_start: string;
    last_24h_rest_3_end: string;
    last_24h_rest_4_start: string;
    last_24h_rest_4_end: string;
    driver_type: string;
    week_starting: string;
    driver_name: string;
    second_driver: string;
  }>({
    last_24h_break: "",
    last_24h_break_start: "",
    last_24h_break_end: "",
    last_24h_rest_1: "",
    last_24h_rest_2: "",
    last_24h_rest_3: "",
    last_24h_rest_4: "",
    last_24h_rest_1_start: "",
    last_24h_rest_1_end: "",
    last_24h_rest_2_start: "",
    last_24h_rest_2_end: "",
    last_24h_rest_3_start: "",
    last_24h_rest_3_end: "",
    last_24h_rest_4_start: "",
    last_24h_rest_4_end: "",
    driver_type: "solo",
    week_starting: "",
    driver_name: "",
    second_driver: "",
  });

  const { data: sheetMeta = [], isLoading: metaLoading } = useQuery({
    queryKey: ["sheets", "meta"],
    queryFn: () => api.sheets.list({ meta: true }),
  });

  const weekOptions = useMemo(() => {
    const weeks = [...new Set(sheetMeta.map((s) => s.week_starting).filter(Boolean))];
    return weeks.sort().reverse();
  }, [sheetMeta]);

  const firstWeekOption = weekOptions[0];

  const weekSelectOptions = useMemo(() => {
    const set = new Set<string>(weekOptions);
    const cur = toYMD(startOfWeekSunday(new Date()));
    set.add(cur);
    if (activeWeekStarting) set.add(activeWeekStarting);
    return [...set].sort().reverse();
  }, [weekOptions, activeWeekStarting]);

  /** Open the calendar on the month that contains the selected work day (not just week Sunday). */
  useEffect(() => {
    if (activeWeekStarting) {
      const workDay = parseYMD(activeWeekStarting);
      workDay.setDate(workDay.getDate() + activeDayIndex);
      setCalView({ y: workDay.getFullYear(), m: workDay.getMonth() });
      return;
    }
    const n = new Date();
    setCalView({ y: n.getFullYear(), m: n.getMonth() });
  }, [activeWeekStarting, activeDayIndex]);

  const calendarWeekAnchor = useMemo(() => {
    return (
      activeWeekStarting ||
      firstWeekOption ||
      toYMD(startOfWeekSunday(new Date()))
    );
  }, [activeWeekStarting, firstWeekOption]);

  /** Week used for the violations snapshot (selected work week, or calendar anchor). */
  const weekForSnapshot = activeWeekStarting || calendarWeekAnchor;

  const weeksToLoad = useMemo(() => {
    const set = new Set<string>();
    if (activeWeekStarting) set.add(activeWeekStarting);
    if (weekForSnapshot) set.add(weekForSnapshot);
    return [...set];
  }, [activeWeekStarting, weekForSnapshot]);

  const { data: weekSheets = [], isLoading: weekSheetsLoading } = useQuery({
    queryKey: ["sheets", "weeks", [...weeksToLoad].sort().join("\0")],
    queryFn: async () => {
      const batches = await Promise.all(
        weeksToLoad.map((w) => api.sheets.list({ weekStarting: w }))
      );
      const byId = new Map<string, FatigueSheet>();
      for (const sheet of batches.flat()) {
        byId.set(sheet.id, sheet);
      }
      return [...byId.values()];
    },
    enabled: weeksToLoad.length > 0,
  });

  const sheets = weekSheets;
  const sheetsLoading = metaLoading || weekSheetsLoading;

  const { driverOptions, regoOptions } = useMemo(() => {
    if (!activeWeekStarting) {
      return { driverOptions: [] as string[], regoOptions: [] as string[] };
    }
    const drivers = new Set<string>();
    const regos = new Set<string>();
    for (const s of sheets) {
      if (s.week_starting !== activeWeekStarting) continue;
      const day = Array.isArray(s.days) ? s.days[activeDayIndex] : undefined;
      if (!dayHasActivity(day)) continue;
      const name = (s.driver_name ?? "").trim();
      if (name) drivers.add(name);
      const rego = typeof day?.truck_rego === "string" ? day.truck_rego.trim() : "";
      if (rego) regos.add(rego);
    }
    return {
      driverOptions: [...drivers].sort((a, b) => a.localeCompare(b)),
      regoOptions: [...regos].sort((a, b) => a.localeCompare(b)),
    };
  }, [sheets, activeWeekStarting, activeDayIndex]);

  useEffect(() => {
    // Wait for sheets before validating, or a URL-restored driver gets cleared.
    if (sheetsLoading) return;
    if (selectedDriverFilter && !driverOptions.includes(selectedDriverFilter)) {
      setSelectedDriverFilter("");
    }
  }, [selectedDriverFilter, driverOptions, sheetsLoading]);

  useEffect(() => {
    if (selectedRegoFilter && !regoOptions.includes(selectedRegoFilter)) {
      setSelectedRegoFilter("");
    }
  }, [selectedRegoFilter, regoOptions]);

  const filteredSheetsForPicker = useMemo(() => {
    if (!activeWeekStarting) return sheets;
    return sheets.filter((s) => {
      if (s.week_starting !== activeWeekStarting) return false;
      const day = Array.isArray(s.days) ? s.days[activeDayIndex] : undefined;
      if (!dayHasActivity(day)) return false;
      if (selectedDriverFilter) {
        if (!isSheetOwnedByDriver(s, selectedDriverFilter)) return false;
      }
      if (selectedRegoFilter) {
        const r = typeof day?.truck_rego === "string" ? day.truck_rego.trim() : "";
        if (r !== selectedRegoFilter) return false;
      }
      return true;
    });
  }, [sheets, activeWeekStarting, activeDayIndex, selectedDriverFilter, selectedRegoFilter]);

  useEffect(() => {
    if (!selectedSheetId) return;
    if (!filteredSheetsForPicker.some((s) => s.id === selectedSheetId)) {
      setSelectedSheetId("");
    }
  }, [selectedSheetId, filteredSheetsForPicker]);

  const prevWeekForSnapshot = useMemo(
    () => (weekForSnapshot ? getPreviousWeekSunday(weekForSnapshot) : ""),
    [weekForSnapshot]
  );

  const scopeResetReadyRef = useRef(false);
  useEffect(() => {
    // Skip the mount run, and skip the run caused by a URL scope restore —
    // otherwise the restored driver pick would immediately flip back to auto.
    if (!scopeResetReadyRef.current) {
      scopeResetReadyRef.current = true;
      return;
    }
    if (restoredScopeRef.current) {
      restoredScopeRef.current = false;
      return;
    }
    setDriverPickManual(false);
  }, [activeWeekStarting, activeDayIndex, selectedRegoFilter]);

  const fleetDriverNamesKey = driverOptions.join("\0");

  const { data: fleetRiskData } = useQuery({
    queryKey: ["manager", "fleet-risk-timeline", weekForSnapshot, fleetDriverNamesKey],
    queryFn: () =>
      api.manager.fleetRiskTimeline({
        weekStarting: weekForSnapshot,
        driverNames: driverOptions.length ? driverOptions : undefined,
      }),
    enabled: !!activeWeekStarting && driverOptions.length > 0,
  });

  const autoChartDriver = useMemo(
    () => pickHighestCurrentRiskDriver(fleetRiskData?.all_drivers ?? fleetRiskData?.drivers ?? []),
    [fleetRiskData?.all_drivers, fleetRiskData?.drivers]
  );

  const chartDriverName = useMemo(() => {
    if (
      driverPickManual &&
      selectedDriverFilter &&
      driverOptions.includes(selectedDriverFilter)
    ) {
      return selectedDriverFilter;
    }
    return autoChartDriver ?? driverOptions[0] ?? null;
  }, [driverPickManual, selectedDriverFilter, driverOptions, autoChartDriver]);

  const chartShiftEvents = useMemo(() => {
    if (!chartDriverName || !weekForSnapshot) return [];
    const out: { time: string; type: string }[] = [];

    for (const sheet of sheets) {
      if (sheet.week_starting !== weekForSnapshot) continue;
      if (!isSheetOwnedByDriver(sheet, chartDriverName)) continue;
      const days = Array.isArray(sheet.days) ? sheet.days : [];
      out.push(...getSheetOwnerEventsInOrder(days));
    }

    out.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    return out;
  }, [chartDriverName, weekForSnapshot, sheets]);

  const chartShiftDayCoverage = useMemo((): ShiftLaneDayCoverage[] => {
    if (!chartDriverName || !weekForSnapshot) return [];

    for (const sheet of sheets) {
      if (sheet.week_starting !== weekForSnapshot) continue;
      if (!isSheetOwnedByDriver(sheet, chartDriverName)) continue;

      const days = Array.isArray(sheet.days) ? sheet.days : [];
      const daysInput = days.map((day) => ({
        assume_idle_from: day?.assume_idle_from,
        events: getSheetOwnerEventsInOrder([{ events: day?.events }]),
      }));
      const prevWeekStarting = getPreviousWeekSunday(weekForSnapshot);
      const prevWeekSheet = sheets.find(
        (s) =>
          s.id !== sheet.id &&
          s.week_starting === prevWeekStarting &&
          isSheetOwnedByDriver(s, chartDriverName)
      );
      const todayStr = getRegulatoryTodayYmd(sheet.jurisdiction_code);
      const rolled = deriveDaysWithRollover(daysInput, weekForSnapshot, {
        todayStr,
        openActivityBeforeFirstDay: resolveOpenActivityBeforeFirstDay(
          prevWeekSheet?.days ?? null,
          prevWeekStarting,
          todayStr
        ),
      });
      const out: ShiftLaneDayCoverage[] = [];
      for (let dayIndex = 0; dayIndex < rolled.length; dayIndex++) {
        const ymd = sheetDayYmdFromIndex(weekForSnapshot, dayIndex);
        const grids = rolled[dayIndex];
        out.push({
          ymd,
          work_time: grids.work_time,
          breaks: grids.breaks,
          non_work: grids.non_work,
        });
      }
      return out;
    }
    return [];
  }, [chartDriverName, weekForSnapshot, sheets]);

  const chartShiftPlanContext = useMemo(() => {
    if (!chartDriverName || !weekForSnapshot) {
      return { segments: [], breakDue: null };
    }
    const blockMs = RISK_BLOCK_MINUTES * 60 * 1000;
    const nowMs = Date.now();
    const windowStart = findNowBlockStartMs(nowMs) - 32 * blockMs;
    const windowEnd = findNowBlockStartMs(nowMs) + 12 * blockMs + blockMs;
    return buildShiftLanePlanContext({
      sheets,
      driverName: chartDriverName,
      weekStarting: weekForSnapshot,
      windowStartMs: windowStart,
      windowEndMs: windowEnd,
      nowMs,
      events: chartShiftEvents,
    });
  }, [chartDriverName, weekForSnapshot, sheets, chartShiftEvents]);

  const handleFleetSelectDriver = (name: string) => {
    setSelectedDriverFilter(name);
    setDriverPickManual(true);
  };

  const handleScopeDriverChange = (value: string) => {
    if (value === "__auto__") {
      setDriverPickManual(false);
      setSelectedDriverFilter("");
      return;
    }
    setSelectedDriverFilter(value);
    setDriverPickManual(true);
  };

  const scrollToCheckIns = () => {
    document.getElementById("manager-check-ins")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const { data: managerCompliance, isLoading: complianceLoading } = useQuery({
    queryKey: ["manager", "compliance", weekForSnapshot],
    queryFn: () => api.manager.compliance({ weekStarting: weekForSnapshot }),
    enabled: !!weekForSnapshot,
  });

  const riskLines = useMemo(() => {
    const nowMs = Date.now();
    const horizonMs = nowMs + 24 * 3600 * 1000;
    if (!activeWeekStarting) return [] as RiskLine[];

    const out: RiskLine[] = [];
    for (const s of sheets) {
      if (s.week_starting !== activeWeekStarting) continue;
      const driver = (s.driver_name || "—").trim() || "—";
      const day = Array.isArray(s.days) ? (s.days[activeDayIndex] as DayData | undefined) : undefined;
      const events = Array.isArray(day?.events) ? (day!.events as { time: string; type: string }[]) : [];
      if (!events.length) continue;

      const last = events[events.length - 1];
      const lastMs = new Date(last.time).getTime();
      const elapsedHrs = (nowMs - lastMs) / 3600000;

      // 1) Break due / overdue when working (prevention-focused, tied to 5h rule).
      const dueBy = getBreakDueByTime(events, nowMs);
      if (dueBy != null && dueBy <= horizonMs) {
        const overdue = dueBy <= nowMs;
        out.push({
          sheetId: s.id,
          driver,
          kind: overdue ? "break_overdue" : "break_due",
          detail: overdue
            ? `Break overdue (was due by ${formatTimeHm(dueBy)})`
            : `Break due by ${formatTimeHm(dueBy)}`,
        });
      }

      // 2) No stop logged for a long time (likely missing End shift).
      if ((last.type === "work" || last.type === "break") && elapsedHrs >= 12) {
        out.push({
          sheetId: s.id,
          driver,
          kind: "no_stop_long",
          detail: `No End shift logged for ${Math.floor(elapsedHrs)}h+ (last: ${last.type})`,
        });
      }

      // 3) If the last event is a stop and it was recent, driver may still be inside 7h recovery window.
      const rolling = getEventsInTimeOrder(
        Array.isArray(s.days)
          ? (s.days as {
              events?: { time: string; type: string; driver?: "primary" | "second" }[];
            }[])
          : []
      );
      const lastStopMs = getLastShiftEndTime(rolling, nowMs + 1);
      const nonWorkHours = getNonWorkHoursSinceLastShiftEnd(rolling, nowMs);
      if ((last.type === "stop" || last.type === "non_work") && lastStopMs != null && nonWorkHours != null && nonWorkHours < 7) {
        const safeAt = lastStopMs + 7 * 3600 * 1000;
        out.push({
          sheetId: s.id,
          driver,
          kind: "insufficient_nonwork",
          detail: `Recovery in progress: ${nonWorkHours.toFixed(1)}h since End shift (7h target by ${formatTimeHm(safeAt)})`,
        });
      }
    }

    // De-dupe by driver+kind (keep earliest).
    const seen = new Set<string>();
    return out.filter((r) => {
      const k = `${r.driver}:${r.kind}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [sheets, activeWeekStarting, activeDayIndex]);

  /** Live timeline signals only (break due, missing end shift, recovery window) — not weekly compliance/risk register. */
  const riskDriverNames = useMemo(
    () => new Set(riskLines.map((r) => r.driver)),
    [riskLines]
  );

  const driverRegister = useMemo(
    () =>
      buildDriverRegister(
        managerCompliance?.items,
        weekForSnapshot,
        sheets,
        riskDriverNames
      ),
    [managerCompliance, weekForSnapshot, sheets, riskDriverNames]
  );

  const riskRegisterFiltered = useMemo(() => {
    let rows = driverRegister;
    if (filterNeedsAttention) rows = rows.filter((r) => r.tier === "attention");
    if (filterNext24) {
      rows = rows.filter((r) => riskDriverNames.has(r.driver));
    }
    return rows;
  }, [driverRegister, filterNeedsAttention, filterNext24, riskDriverNames]);

  const complianceSheetsForPicker = useMemo(() => {
    let list = filteredSheetsForPicker;
    if (filterUnsigned) {
      list = list.filter((s) => !s.signature);
    }
    if (filterRecordGaps && managerCompliance?.items) {
      const gapSheetIds = new Set(
        managerCompliance.items
          .filter((item) => item.week_starting === weekForSnapshot)
          .filter((item) =>
            (item.results ?? []).some(
              (r) =>
                r.type === "warning" &&
                !r.message.toLowerCase().includes("run plan")
            )
          )
          .map((item) => item.sheetId)
      );
      list = list.filter((s) => gapSheetIds.has(s.id));
    }
    return list;
  }, [
    filteredSheetsForPicker,
    filterUnsigned,
    filterRecordGaps,
    managerCompliance,
    weekForSnapshot,
  ]);

  const attentionItems = useMemo(() => {
    if (!filterNext24 && !filterNeedsAttention) return riskLines;
    if (filterNext24) return riskLines;
    if (filterNeedsAttention) {
      const names = new Set(
        driverRegister.filter((r) => r.tier === "attention").map((r) => r.driver)
      );
      return riskLines.filter((r) => names.has(r.driver));
    }
    return riskLines;
  }, [riskLines, filterNext24, filterNeedsAttention, driverRegister]);

  const weekAssuranceLines = useMemo(
    () => assuranceLinesForWeek(managerCompliance?.items, weekForSnapshot),
    [managerCompliance, weekForSnapshot]
  );

  const prevWeekAssuranceLines = useMemo(
    () => assuranceLinesForWeek(managerCompliance?.items, prevWeekForSnapshot),
    [managerCompliance, prevWeekForSnapshot]
  );

  const assuranceLinesFiltered = useMemo(() => {
    const filterByDriver = (lines: AssuranceLine[]) => {
      if (!selectedDriverFilter) return lines;
      return lines.filter((l) => l.driver === selectedDriverFilter);
    };
    return {
      current: filterByDriver(weekAssuranceLines),
      prior: filterByDriver(prevWeekAssuranceLines),
    };
  }, [weekAssuranceLines, prevWeekAssuranceLines, selectedDriverFilter]);

  const domainKpis = useMemo(
    () =>
      buildManagerDomainKpis({
        driverRegister,
        breachCount: assuranceLinesFiltered.current.length,
        unsignedSheetCount: countUnsignedSheetsForWeek(
          sheets,
          weekForSnapshot,
          selectedDriverFilter || undefined
        ),
        driverFilter: selectedDriverFilter || undefined,
      }),
    [
      driverRegister,
      assuranceLinesFiltered.current.length,
      sheets,
      weekForSnapshot,
      selectedDriverFilter,
    ]
  );

  const { data: selectedSheet, isLoading: sheetLoading } = useQuery({
    queryKey: ["sheet", selectedSheetId],
    queryFn: () => api.sheets.get(selectedSheetId),
    enabled: !!selectedSheetId,
  });

  const { data: selectedSheetComplianceHistory } = useQuery({
    queryKey: ["sheet", selectedSheetId, "compliance-history"],
    queryFn: () => api.sheets.complianceHistory(selectedSheetId),
    enabled: !!selectedSheetId,
  });

  const declared24hRestFields = useMemo(
    (): Declared24hRestFields => ({
      last_24h_rest_1: form.last_24h_rest_1 || null,
      last_24h_rest_2: form.last_24h_rest_2 || null,
      last_24h_rest_3: form.last_24h_rest_3 || null,
      last_24h_rest_4: form.last_24h_rest_4 || null,
      last_24h_rest_1_start: form.last_24h_rest_1_start || null,
      last_24h_rest_1_end: form.last_24h_rest_1_end || null,
      last_24h_rest_2_start: form.last_24h_rest_2_start || null,
      last_24h_rest_2_end: form.last_24h_rest_2_end || null,
      last_24h_rest_3_start: form.last_24h_rest_3_start || null,
      last_24h_rest_3_end: form.last_24h_rest_3_end || null,
      last_24h_rest_4_start: form.last_24h_rest_4_start || null,
      last_24h_rest_4_end: form.last_24h_rest_4_end || null,
    }),
    [
      form.last_24h_rest_1,
      form.last_24h_rest_2,
      form.last_24h_rest_3,
      form.last_24h_rest_4,
      form.last_24h_rest_1_start,
      form.last_24h_rest_1_end,
      form.last_24h_rest_2_start,
      form.last_24h_rest_2_end,
      form.last_24h_rest_3_start,
      form.last_24h_rest_3_end,
      form.last_24h_rest_4_start,
      form.last_24h_rest_4_end,
    ]
  );

  const declared24hRestRequirement = useMemo(() => {
    if (!selectedSheet || selectedSheet.id !== selectedSheetId) {
      return { fieldCount: 0 as const, reason: "none" as const };
    }
    return getDeclared24hRestRequirementFromSheets({
      driverType: form.driver_type,
      weekStarting: selectedSheet.week_starting,
      days: selectedSheet.days ?? [],
      prevWeekDays: selectedSheetComplianceHistory?.prev_week_days ?? null,
      historyDays: selectedSheetComplianceHistory?.history_days ?? null,
      declaredFields: declared24hRestFields,
    });
  }, [
    selectedSheet,
    selectedSheetId,
    selectedSheetComplianceHistory,
    form.driver_type,
    declared24hRestFields,
  ]);

  const selectedSheetComplianceMessages = useMemo(() => {
    if (!selectedSheetId || !managerCompliance?.items?.length) return [] as string[];
    const item = managerCompliance.items.find((i) => i.sheetId === selectedSheetId);
    return (item?.results ?? []).map((r) => r.message);
  }, [selectedSheetId, managerCompliance]);

  const declared24hRestUiFieldCount = useMemo(
    (): 0 | 2 | 4 =>
      resolveDeclared24hRestUiFieldCount({
        requirement: declared24hRestRequirement,
        fields: declared24hRestFields,
        complianceMessages: selectedSheetComplianceMessages,
      }),
    [
      declared24hRestRequirement,
      declared24hRestFields,
      selectedSheetComplianceMessages,
    ]
  );

  const handleDeclared24hRestChange = useCallback(
    (key: Declared24hRestKey, range: { startIso: string; endIso: string } | null) => {
      const { start, end } = declaredRestRangeKeys(key);
      setForm((f) => {
        const nextFields: Declared24hRestFields = {
          last_24h_rest_1: f.last_24h_rest_1 || null,
          last_24h_rest_2: f.last_24h_rest_2 || null,
          last_24h_rest_3: f.last_24h_rest_3 || null,
          last_24h_rest_4: f.last_24h_rest_4 || null,
          last_24h_rest_1_start: f.last_24h_rest_1_start || null,
          last_24h_rest_1_end: f.last_24h_rest_1_end || null,
          last_24h_rest_2_start: f.last_24h_rest_2_start || null,
          last_24h_rest_2_end: f.last_24h_rest_2_end || null,
          last_24h_rest_3_start: f.last_24h_rest_3_start || null,
          last_24h_rest_3_end: f.last_24h_rest_3_end || null,
          last_24h_rest_4_start: f.last_24h_rest_4_start || null,
          last_24h_rest_4_end: f.last_24h_rest_4_end || null,
          [key]: range ? isoToPerthYmd(range.startIso) ?? "" : "",
          [start]: range?.startIso ?? "",
          [end]: range?.endIso ?? "",
        };
        const soft = softResetFieldsFromDeclaredRests(nextFields, isoToPerthYmd);
        return {
          ...f,
          [key]: nextFields[key]?.toString() ?? "",
          [start]: nextFields[start]?.toString() ?? "",
          [end]: nextFields[end]?.toString() ?? "",
          last_24h_break: soft.last_24h_break,
          last_24h_break_start: soft.last_24h_break_start,
          last_24h_break_end: soft.last_24h_break_end,
        };
      });
    },
    []
  );

  useEffect(() => {
    if (!selectedSheetId) {
      setForm({
        last_24h_break: "",
        last_24h_break_start: "",
        last_24h_break_end: "",
        last_24h_rest_1: "",
        last_24h_rest_2: "",
        last_24h_rest_3: "",
        last_24h_rest_4: "",
        last_24h_rest_1_start: "",
        last_24h_rest_1_end: "",
        last_24h_rest_2_start: "",
        last_24h_rest_2_end: "",
        last_24h_rest_3_start: "",
        last_24h_rest_3_end: "",
        last_24h_rest_4_start: "",
        last_24h_rest_4_end: "",
        driver_type: "solo",
        week_starting: "",
        driver_name: "",
        second_driver: "",
      });
      return;
    }
    if (!selectedSheet || selectedSheet.id !== selectedSheetId) return;
    const seededRests = seedSoftResetRangeIntoDeclaredRests({
      fields: declared24hRestsFromSheet(selectedSheet),
      last24hBreak: selectedSheet.last_24h_break,
      last24hBreakStart: selectedSheet.last_24h_break_start,
      last24hBreakEnd: selectedSheet.last_24h_break_end,
      isoToPerthYmd,
    });
    const softFromRests = softResetFieldsFromDeclaredRests(seededRests, isoToPerthYmd);
    setForm({
      last_24h_break: softFromRests.last_24h_break || selectedSheet.last_24h_break || "",
      last_24h_break_start:
        softFromRests.last_24h_break_start || selectedSheet.last_24h_break_start || "",
      last_24h_break_end:
        softFromRests.last_24h_break_end || selectedSheet.last_24h_break_end || "",
      last_24h_rest_1: seededRests.last_24h_rest_1 ?? "",
      last_24h_rest_2: seededRests.last_24h_rest_2 ?? "",
      last_24h_rest_3: seededRests.last_24h_rest_3 ?? "",
      last_24h_rest_4: seededRests.last_24h_rest_4 ?? "",
      last_24h_rest_1_start: seededRests.last_24h_rest_1_start ?? "",
      last_24h_rest_1_end: seededRests.last_24h_rest_1_end ?? "",
      last_24h_rest_2_start: seededRests.last_24h_rest_2_start ?? "",
      last_24h_rest_2_end: seededRests.last_24h_rest_2_end ?? "",
      last_24h_rest_3_start: seededRests.last_24h_rest_3_start ?? "",
      last_24h_rest_3_end: seededRests.last_24h_rest_3_end ?? "",
      last_24h_rest_4_start: seededRests.last_24h_rest_4_start ?? "",
      last_24h_rest_4_end: seededRests.last_24h_rest_4_end ?? "",
      driver_type: selectedSheet.driver_type ?? "solo",
      week_starting: selectedSheet.week_starting ?? "",
      driver_name: selectedSheet.driver_name ?? "",
      second_driver: selectedSheet.second_driver ?? "",
    });
  }, [selectedSheet, selectedSheetId]);

  const saveMutation = useMutation({
    mutationFn: (payload: SheetUpdatePayload) =>
      updateSheetOfflineFirst(selectedSheetId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheet", selectedSheetId] });
      queryClient.invalidateQueries({ queryKey: ["sheets"] });
      queryClient.invalidateQueries({ queryKey: ["manager", "compliance"] });
    },
  });

  const amendMutation = useMutation({
    mutationFn: (reason: string) =>
      updateSheetOfflineFirst(selectedSheetId, { amendment_reason: reason.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheet", selectedSheetId] });
      queryClient.invalidateQueries({ queryKey: ["sheets"] });
      queryClient.invalidateQueries({ queryKey: ["manager", "compliance"] });
      setShowAmendDialog(false);
      setAmendmentReason("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.sheets.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheets"] });
      queryClient.invalidateQueries({ queryKey: ["sheet", selectedSheetId] });
      queryClient.invalidateQueries({ queryKey: ["manager", "compliance"] });
      setSelectedSheetId("");
    },
  });

  const handleDelete = () => {
    if (!selectedSheetId) return;
    if (!confirm("Delete this sheet? This cannot be undone.")) return;
    deleteMutation.mutate(selectedSheetId);
  };

  const selectedIsPastWeek = useMemo(
    () =>
      Boolean(
        selectedSheet?.week_starting && isPastRegulatoryWeek(selectedSheet.week_starting)
      ),
    [selectedSheet?.week_starting]
  );

  const managerEditNeedsReason = useMemo(
    () =>
      Boolean(
        selectedSheet &&
          (selectedIsPastWeek || (selectedSheet.status ?? "") === "completed")
      ),
    [selectedSheet, selectedIsPastWeek]
  );

  const hasChanges =
    selectedSheet &&
    (form.last_24h_break !== (selectedSheet.last_24h_break ?? "") ||
      form.last_24h_break_start !== (selectedSheet.last_24h_break_start ?? "") ||
      form.last_24h_break_end !== (selectedSheet.last_24h_break_end ?? "") ||
      form.last_24h_rest_1 !== (selectedSheet.last_24h_rest_1 ?? "") ||
      form.last_24h_rest_2 !== (selectedSheet.last_24h_rest_2 ?? "") ||
      form.last_24h_rest_3 !== (selectedSheet.last_24h_rest_3 ?? "") ||
      form.last_24h_rest_4 !== (selectedSheet.last_24h_rest_4 ?? "") ||
      form.last_24h_rest_1_start !== (selectedSheet.last_24h_rest_1_start ?? "") ||
      form.last_24h_rest_1_end !== (selectedSheet.last_24h_rest_1_end ?? "") ||
      form.last_24h_rest_2_start !== (selectedSheet.last_24h_rest_2_start ?? "") ||
      form.last_24h_rest_2_end !== (selectedSheet.last_24h_rest_2_end ?? "") ||
      form.last_24h_rest_3_start !== (selectedSheet.last_24h_rest_3_start ?? "") ||
      form.last_24h_rest_3_end !== (selectedSheet.last_24h_rest_3_end ?? "") ||
      form.last_24h_rest_4_start !== (selectedSheet.last_24h_rest_4_start ?? "") ||
      form.last_24h_rest_4_end !== (selectedSheet.last_24h_rest_4_end ?? "") ||
      form.driver_type !== (selectedSheet.driver_type ?? "solo") ||
      form.week_starting !== (selectedSheet.week_starting ?? "") ||
      form.driver_name !== (selectedSheet.driver_name ?? "") ||
      form.second_driver !== (selectedSheet.second_driver ?? ""));

  const handleSave = () => {
    if (!selectedSheetId || !selectedSheet || selectedSheet.id !== selectedSheetId) return;
    const reason = amendmentReason.trim();
    if (managerEditNeedsReason && hasChanges && !reason) {
      window.alert("Enter an amendment reason before saving changes to a past or completed sheet.");
      return;
    }
    const showDeclaredRests =
      form.driver_type !== "two_up" && declared24hRestUiFieldCount >= 2;
    saveMutation.mutate({
      last_24h_break: form.last_24h_break.trim() || null,
      last_24h_break_start: form.last_24h_break_start.trim() || null,
      last_24h_break_end: form.last_24h_break_end.trim() || null,
      driver_type: form.driver_type,
      week_starting: form.week_starting || undefined,
      destination: null,
      driver_name: form.driver_name || undefined,
      second_driver: form.second_driver || undefined,
      ...(showDeclaredRests
        ? {
            last_24h_rest_1: form.last_24h_rest_1.trim() || null,
            last_24h_rest_2: form.last_24h_rest_2.trim() || null,
            last_24h_rest_1_start: form.last_24h_rest_1_start.trim() || null,
            last_24h_rest_1_end: form.last_24h_rest_1_end.trim() || null,
            last_24h_rest_2_start: form.last_24h_rest_2_start.trim() || null,
            last_24h_rest_2_end: form.last_24h_rest_2_end.trim() || null,
            ...(declared24hRestUiFieldCount === 4
              ? {
                  last_24h_rest_3: form.last_24h_rest_3.trim() || null,
                  last_24h_rest_4: form.last_24h_rest_4.trim() || null,
                  last_24h_rest_3_start: form.last_24h_rest_3_start.trim() || null,
                  last_24h_rest_3_end: form.last_24h_rest_3_end.trim() || null,
                  last_24h_rest_4_start: form.last_24h_rest_4_start.trim() || null,
                  last_24h_rest_4_end: form.last_24h_rest_4_end.trim() || null,
                }
              : {}),
          }
        : {}),
      ...(managerEditNeedsReason && reason ? { amendment_reason: reason } : {}),
    });
  };

  const handleAssuranceFix = useCallback((line: AssuranceLine, route: ComplianceFixRoute) => {
    setSelectedSheetId(line.sheetId);
    if (route.kind === "edit_day" && route.scrollDayIndex != null) {
      window.location.href = `/sheets/${line.sheetId}#fatigue-day-${route.scrollDayIndex}`;
      return;
    }
    window.requestAnimationFrame(() => {
      document.getElementById("record-edits")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const canAmend =
    !!selectedSheetId &&
    (selectedSheet?.status ?? "") === "completed" &&
    Boolean(selectedSheet?.signature);

  const scopeCalendarProps = {
    viewYear: calView.y,
    viewMonth: calView.m,
    onViewPrev: () =>
      setCalView(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 })),
    onViewNext: () =>
      setCalView(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 })),
    weekStartingYmd: calendarWeekAnchor,
    activeDayIndex: activeDayIndex,
    onSelectDate: (weekStartingYmd: string, dayIndex: number) => {
      setActiveWeekStarting(weekStartingYmd);
      setActiveDayIndex(dayIndex);
      const workDay = parseYMD(weekStartingYmd);
      workDay.setDate(workDay.getDate() + dayIndex);
      setCalView({ y: workDay.getFullYear(), m: workDay.getMonth() });
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className={MANAGER_PAGE_SHELL}>
        <PageHeader
          title={MANAGER_EXPERIENCE.PAGE_TITLE}
          subtitle={MANAGER_EXPERIENCE.PAGE_SUBTITLE}
          icon={<Shield className="w-5 h-5" />}
          showLobbyLink={false}
          actions={
            <Button
              variant="outline"
              className="gap-2 text-slate-600 dark:text-slate-300"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="w-4 h-4" />
              Log out
            </Button>
          }
        />

        <ManagerSubnav />

        <ManagerDomainsOverview kpis={domainKpis} />

        <ManagerDomainSection
          id="risk-analysis"
          variant="risk"
          title={MANAGER_EXPERIENCE.SECTION_RISK_TITLE}
          subtitle={MANAGER_EXPERIENCE.SECTION_RISK_SUBTITLE}
          boundary={MANAGER_EXPERIENCE.SECTION_RISK_BOUNDARY}
        >
          <ManagerArchiveAccessControls />
          <ManagerRiskScopeBar
            weekSelectOptions={weekSelectOptions}
            activeWeekStarting={activeWeekStarting}
            onWeekChange={(week) => {
              if (week && !HOT_WINDOW_ALL_LIVE && !isWeekStartingInHotWindow(week)) {
                window.alert(MANAGER_EXPERIENCE.ARCHIVE_ACCESS_OUTSIDE_LIVE);
                return;
              }
              setActiveWeekStarting(week);
            }}
            dayLabel={
              activeWeekStarting
                ? formatDayDateLabel(activeWeekStarting, activeDayIndex)
                : "Pick week first"
            }
            calendar={scopeCalendarProps}
            driverOptions={driverOptions}
            driverValue={driverPickManual && selectedDriverFilter ? selectedDriverFilter : "__auto__"}
            onDriverChange={handleScopeDriverChange}
            regoOptions={regoOptions}
            regoValue={selectedRegoFilter || "__all__"}
            onRegoChange={(v) => setSelectedRegoFilter(v === "__all__" ? "" : v)}
            sheetsLoading={sheetsLoading}
            autoDriverLabel={autoChartDriver}
            formatWeekLabel={formatWeekLabel}
          />

          {activeWeekStarting && driverOptions.length > 0 ? (
            <ManagerFleetRiskPulse
              weekStarting={weekForSnapshot}
              driverNames={driverOptions}
              selectedDriver={chartDriverName || undefined}
              onSelectDriver={handleFleetSelectDriver}
              checkInCount={attentionItems.length}
              onScrollToCheckIns={scrollToCheckIns}
              mapDayIndex={activeDayIndex}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-teal-200 bg-teal-50/50 px-4 py-3 text-sm text-teal-900 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-100">
              {MANAGER_EXPERIENCE.FLEET_PULSE_EMPTY}
            </p>
          )}

          {chartDriverName ? (
            <ManagerRiskTimelineDashboard
                driverName={chartDriverName}
                weekStarting={weekForSnapshot}
                demo
                autoSelected={!driverPickManual}
                mapDayIndex={activeDayIndex}
                shiftEvents={chartShiftEvents}
                shiftDayCoverage={chartShiftDayCoverage}
                shiftPlanContext={chartShiftPlanContext}
              />
          ) : null}

          <ManagerReferencePanel
            library={PROSPECTIVE_RISK_REFERENCE}
            variant="risk"
            toggleOpenLabel={MANAGER_EXPERIENCE.RISK_REFERENCE_TOGGLE}
          />

          <p className="text-sm text-slate-500 dark:text-slate-400">{MANAGER_EXPERIENCE.TAB_IDENTIFY_HELP}</p>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={filterNeedsAttention ? "default" : "outline"}
              className={filterNeedsAttention ? "bg-rose-700 hover:bg-rose-800 dark:bg-rose-700" : ""}
              onClick={() => setFilterNeedsAttention((v) => !v)}
            >
              {MANAGER_EXPERIENCE.FILTER_ATTENTION}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filterNext24 ? "default" : "outline"}
              className={filterNext24 ? "bg-violet-700 hover:bg-violet-800 dark:bg-violet-600" : ""}
              onClick={() => setFilterNext24((v) => !v)}
            >
              {MANAGER_EXPERIENCE.FILTER_NEXT24}
            </Button>
          </div>

          <div id="manager-check-ins">
            <ManagerAttentionPanel items={attentionItems} />
          </div>

          <ManagerDriverRegister rows={riskRegisterFiltered} loading={complianceLoading} />
        </ManagerDomainSection>

        <ManagerDomainSection
          id="compliance-analysis"
          variant="compliance"
          title={MANAGER_EXPERIENCE.SECTION_COMPLIANCE_TITLE}
          subtitle={MANAGER_EXPERIENCE.SECTION_COMPLIANCE_SUBTITLE}
          boundary={MANAGER_EXPERIENCE.SECTION_COMPLIANCE_BOUNDARY}
        >
          <ManagerAssuranceSignals
            currentWeekLabel={formatWeekLabel(weekForSnapshot)}
            priorWeekLabel={formatWeekLabel(prevWeekForSnapshot)}
            currentLines={assuranceLinesFiltered.current}
            priorLines={assuranceLinesFiltered.prior}
            loading={complianceLoading}
            embedded
            onFixLine={handleAssuranceFix}
          />

          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {MANAGER_EXPERIENCE.COMPLIANCE_REGULATORY_INTRO}
            </p>
            <ManagerReferencePanel
              library={REGULATORY_REQUIREMENTS_REFERENCE}
              variant="regulatory"
              className="mb-0 border-2 border-amber-200/90 bg-white/90 dark:border-amber-800/50 dark:bg-slate-950/50"
            />
          </div>
        </ManagerDomainSection>

        <ManagerDomainSection
          id="record-edits"
          variant="edit"
          title={MANAGER_EXPERIENCE.SECTION_EDIT_TITLE}
          subtitle={MANAGER_EXPERIENCE.SECTION_EDIT_SUBTITLE}
          boundary={MANAGER_EXPERIENCE.SECTION_EDIT_BOUNDARY}
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">{MANAGER_EXPERIENCE.TAB_RECORDS_HELP}</p>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={filterRecordGaps ? "default" : "outline"}
              onClick={() => setFilterRecordGaps((v) => !v)}
            >
              {MANAGER_EXPERIENCE.FILTER_GAPS}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filterUnsigned ? "default" : "outline"}
              onClick={() => setFilterUnsigned((v) => !v)}
            >
              {MANAGER_EXPERIENCE.FILTER_UNSIGNED}
            </Button>
          </div>

          <div className="space-y-4 rounded-xl border border-teal-200/90 bg-white/80 p-4 dark:border-teal-800/50 dark:bg-slate-950/60">
              <div className="space-y-2">
                <Label
                  htmlFor="manager-record-sheet"
                  className="text-xs font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-200"
                >
                  {MANAGER_EXPERIENCE.RECORDS_SHEET_LABEL}
                </Label>
                <Select
                  value={selectedSheetId || "__none__"}
                  onValueChange={(id) => setSelectedSheetId(id === "__none__" ? "" : id)}
                  disabled={sheetsLoading}
                >
                  <SelectTrigger
                    id="manager-record-sheet"
                    className="h-11 min-h-11 w-full max-w-md border-2 border-teal-300/90 bg-teal-50/80 text-sm font-medium text-slate-900 shadow-sm focus:ring-2 focus:ring-teal-500 focus:ring-offset-0 dark:border-teal-600/55 dark:bg-teal-950/40 dark:text-teal-50 dark:focus:ring-teal-400"
                  >
                    <SelectValue
                      placeholder={
                        complianceSheetsForPicker.length === 0 && activeWeekStarting
                          ? MANAGER_EXPERIENCE.RECORDS_SHEET_EMPTY_DAY
                          : sheetMeta.length === 0
                            ? MANAGER_EXPERIENCE.RECORDS_SHEET_EMPTY_FLEET
                            : MANAGER_EXPERIENCE.RECORDS_SHEET_PLACEHOLDER
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{MANAGER_EXPERIENCE.RECORDS_SHEET_PLACEHOLDER}</SelectItem>
                    {complianceSheetsForPicker.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {formatSheetLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!selectedSheetId && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {MANAGER_EXPERIENCE.RECORDS_SHEET_HINT}
                  </p>
                )}
                {activeWeekStarting &&
                  complianceSheetsForPicker.length === 0 &&
                  sheets.length > 0 &&
                  !sheetsLoading && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      No sheets have data on the selected day for this week (and current driver/rego filters).
                      Change the calendar day, filters, or work week.
                    </p>
                  )}
                {sheetMeta.length === 0 && !sheetsLoading && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    No sheets yet. Ask drivers to create a sheet from the driver app first.
                  </p>
                )}
              </div>

              {selectedSheetId && (
                <>
                  {sheetLoading || !selectedSheet || selectedSheet.id !== selectedSheetId ? (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-4">
                      <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        Loading sheet…
                      </div>
                      <div className="space-y-3 animate-pulse">
                        <div className="h-9 bg-slate-200 dark:bg-slate-700 rounded w-full max-w-xs" />
                        <div className="h-9 bg-slate-200 dark:bg-slate-700 rounded w-32" />
                        <div className="h-9 bg-slate-200 dark:bg-slate-700 rounded w-full max-w-xs" />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <div className="space-y-1.5 sm:col-span-2 rounded-lg border border-teal-200/80 bg-teal-50/50 px-3 py-2 dark:border-teal-800/50 dark:bg-teal-950/30">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-200">
                          Sheet driver
                        </p>
                        <p className="text-base font-bold text-slate-900 dark:text-slate-50">
                          {(selectedSheet.driver_name || "").trim() || "—"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          From this sheet record. Edit “Driver name” below only to correct the stored name.
                        </p>
                      </div>
                      {form.driver_type !== "two_up" && declared24hRestUiFieldCount >= 2 && (
                        <div className="sm:col-span-2">
                          <Declared24hRestsField
                            fieldCount={declared24hRestUiFieldCount === 4 ? 4 : 2}
                            values={declared24hRestFields}
                            onRangeChange={handleDeclared24hRestChange}
                            allowAmend
                          />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                          Driver type
                        </Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={form.driver_type === "solo" ? "default" : "outline"}
                          onClick={() => setForm((f) => ({ ...f, driver_type: "solo" }))}
                        >
                          Solo
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={form.driver_type === "two_up" ? "default" : "outline"}
                          onClick={() => setForm((f) => ({ ...f, driver_type: "two_up" }))}
                        >
                          Two-Up
                        </Button>
                      </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                          Week starting
                        </Label>
                        <Input
                          type="date"
                          value={form.week_starting}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              week_starting: e.target.value,
                            }))
                          }
                          className="h-9 font-mono"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                          Driver name
                        </Label>
                        <Input
                          value={form.driver_name}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              driver_name: e.target.value,
                            }))
                          }
                          placeholder="Driver name"
                          className="h-9 max-w-xs"
                        />
                      </div>
                      {form.driver_type === "two_up" && (
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                            Relief driver (name only)
                          </Label>
                          <Input
                            value={form.second_driver}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                second_driver: e.target.value,
                              }))
                            }
                            placeholder="Relief driver on this crew"
                            className="h-9 max-w-xs"
                          />
                          <p className="text-xs text-slate-400 leading-snug">
                            One sheet per driver per week. Create a separate sheet for the relief driver;
                            this field is context on this driver&apos;s record only.
                          </p>
                        </div>
                      )}
                      {managerEditNeedsReason && (
                        <div className="sm:col-span-2 space-y-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 p-3">
                          <p className="text-xs text-amber-900 dark:text-amber-100">
                            {selectedIsPastWeek
                              ? MANAGER_PAST_WEEK_AMEND_HINT
                              : SHEET_ATTESTATION_WORKFLOW.MANAGER_AMEND_UNTIL_AGREED}
                          </p>
                          <Label
                            htmlFor="inline_amendment_reason"
                            className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold"
                          >
                            Amendment reason (required for each save)
                          </Label>
                          <Input
                            id="inline_amendment_reason"
                            value={amendmentReason}
                            onChange={(e) => setAmendmentReason(e.target.value)}
                            placeholder="e.g. Corrected odometer per driver"
                            className="h-9"
                          />
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {SHEET_ATTESTATION_WORKFLOW.MANAGER_SEND_FOR_DRIVER_SIGN}
                          </p>
                        </div>
                      )}
                      <div className="sm:col-span-2 flex items-center gap-3 pt-2">
                        <Button
                          onClick={handleSave}
                          disabled={
                            !hasChanges ||
                            saveMutation.isPending ||
                            (managerEditNeedsReason && !amendmentReason.trim())
                          }
                          className="gap-2"
                        >
                          {saveMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : saveMutation.isSuccess ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          Save changes
                        </Button>
                        {canAmend && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 border-amber-300 text-amber-800 hover:bg-amber-50"
                            onClick={() => setShowAmendDialog(true)}
                            disabled={amendMutation.isPending || saveMutation.isPending}
                          >
                            <FileEdit className="w-4 h-4" />
                            Amend (unlock)
                          </Button>
                        )}
                        {saveMutation.isSuccess && (
                          <span className="text-sm text-green-600">
                            Saved.
                          </span>
                        )}
                        {saveMutation.isError && (
                          <span className="text-sm text-red-600">
                            {saveMutation.error instanceof Error
                              ? saveMutation.error.message
                              : "Save failed"}
                          </span>
                        )}
                        <Link href={selectedSheetId ? `/sheets/${selectedSheetId}` : "/sheets"}>
                          <Button variant="outline" size="sm">
                            Open sheet
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/50 hover:border-red-300 dark:hover:border-red-700 gap-1"
                          disabled={deleteMutation.isPending}
                          onClick={handleDelete}
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          Delete sheet
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
          </div>
        </ManagerDomainSection>

        <Dialog open={showAmendDialog} onOpenChange={setShowAmendDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unlock record for agreed correction</DialogTitle>
              <DialogDescription>
                Clears the driver&apos;s signature so you can edit with a reason on file. When you both agree the week is correct, they sign again — document control, not discipline.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="amendment_reason" className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Amendment reason (required)
              </Label>
              <Input
                id="amendment_reason"
                value={amendmentReason}
                onChange={(e) => setAmendmentReason(e.target.value)}
                placeholder="e.g. Corrected start KM entered incorrectly by driver"
              />
              {amendMutation.isError && (
                <p className="text-sm text-red-600">
                  {amendMutation.error instanceof Error ? amendMutation.error.message : "Amendment failed."}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAmendDialog(false)} disabled={amendMutation.isPending}>
                Cancel
              </Button>
              <Button
                className="gap-2"
                onClick={() => amendMutation.mutate(amendmentReason)}
                disabled={amendMutation.isPending || amendmentReason.trim().length === 0}
              >
                {amendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Amend & unlock
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
