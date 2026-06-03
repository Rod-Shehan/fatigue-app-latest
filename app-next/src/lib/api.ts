/**
 * API client – replaces Base44 SDK calls.
 * All routes require an active session (cookie).
 */

import type { RecordRetentionPolicy } from "@/lib/record-retention";

export type { RecordRetentionPolicy };

// In the browser we use relative URLs so the request goes to the same origin (and sends cookies).
const base = typeof window !== "undefined" ? "" : process.env.NEXTAUTH_URL ?? "";

type FetchApiOptions = Omit<RequestInit, "body"> & { body?: object };

async function fetchApi<T>(path: string, options?: FetchApiOptions): Promise<T> {
  const { method = "GET", body, ...rest } = options ?? {};
  const fetchOptions: RequestInit = {
    ...rest,
    method,
    headers: {
      "Content-Type": "application/json",
      ...rest.headers,
    },
    credentials: "include",
    ...(body !== undefined && { body: JSON.stringify(body) }),
  };
  const res = await fetch(`${base}${path}`, fetchOptions);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const msg = (err as { error?: string }).error ?? "Request failed";
    const e = new Error(msg) as Error & { body?: Record<string, unknown> };
    e.body = err as Record<string, unknown>;
    throw e;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type Driver = {
  id: string;
  name: string;
  email?: string | null;
  licence_number?: string;
  /** WA Commercial Driver's Medical expiry (YYYY-MM-DD), optional. */
  cvd_medical_expiry?: string | null;
  is_active: boolean;
};
export type Rego = { id: string; label: string; sort_order: number };
export type DayData = {
  day_label?: string;
  date?: string;
  truck_rego?: string;
  /** Where the day's shift / route began (regulator audit: opposite end to destination). */
  start_location?: string;
  destination?: string;
  start_kms?: number | null;
  end_kms?: number | null;
  /** Day (A) / Night (B) — for Reg 184E(4) shift-pattern change after 5+ work days. */
  shift_label?: "A" | "B" | "";
  /** Driver confirmed route/vehicle for this calendar day (required after overnight carry from previous day). */
  route_confirmed?: boolean;
  work_time?: boolean[];
  breaks?: boolean[];
  non_work?: boolean[];
  events?: Array<{
    time: string;
    type: string;
    lat?: number;
    lng?: number;
    accuracy?: number;
    /** When two-up: which named driver was driving for this work segment. */
    driver?: "primary" | "second";
  }>;
  /** When set (ISO string), work/break is capped at this time on that day; from then to "now" shows as non-work ("forgot to end shift" / assume idle). */
  assume_idle_from?: string;
  /** Prospective run plan (ADR 0003) — future segments only for risk engine. */
  route_label?: string;
  planned_distance_km?: number | null;
  planned_on_duty_hours?: number | null;
  route_source?: "adhoc" | "driver_saved" | "org_preset";
  route_preset_id?: string;
};
export type FatigueSheet = {
  id: string;
  /** WA OSH Reg 3.132 today; more codes when engines ship (ADR 0001). */
  jurisdiction_code?: string;
  driver_name: string;
  second_driver?: string;
  driver_type: string;
  /** Deprecated: use per-day `days[].destination` only; may be null from API. */
  destination?: string | null;
  last_24h_break?: string;
  week_starting: string;
  days: DayData[];
  status: string;
  signature?: string;
  signed_at?: string;
  created_by?: string;
  created_date?: string;
};

export type SheetUpdatePayload = Partial<FatigueSheet> & {
  /** Required when amending a completed sheet (manager only). */
  amendment_reason?: string;
};

/** Compliance check result (server is source of truth). */
export type ComplianceCheckResult = {
  type: "violation" | "warning" | "info";
  iconKey: "Coffee" | "AlertTriangle" | "Moon" | "Clock" | "TrendingUp" | "CheckCircle2" | "MapPin";
  day: string;
  message: string;
  ruleId?: "shift_change_24h" | "shift_change_education" | "location_evidence" | "odometer_gps_plausibility";
  scrollDayIndex?: number;
  shiftChange?: {
    fromDayIndex: number;
    toDayIndex: number;
    fromLabel: "A" | "B";
    toLabel: "A" | "B";
    gapHours: number;
    stopTimeIso?: string;
    workTimeIso?: string;
  };
};

/** One sheet's compliance results for manager oversight. */
export type ProspectiveRiskLevel = "low" | "monitor" | "elevated" | "critical";

export type RiskRegisterEntry = {
  segmentId: string;
  dayIndex: number;
  routeLabel: string;
  scenario: "planned" | "high" | "low";
  likelihood: number;
  consequence: number;
  riskLevel: ProspectiveRiskLevel;
  residualRiskLevel: ProspectiveRiskLevel;
  outcomes: string[];
  barriers: string[];
  summary: string;
  plannedHours: number;
  plannedKm: number | null;
};

export type RiskRegisterSummary = {
  baselineHeadroomHours: number;
  entries: RiskRegisterEntry[];
  worstLevel: ProspectiveRiskLevel;
  driverHint: string | null;
};

export type ManagerComplianceItem = {
  sheetId: string;
  driver_name: string;
  week_starting: string;
  results: ComplianceCheckResult[];
  eventsWithLocation?: number;
  totalEvents?: number;
  /** Prospective risk on future segments with run plans (ADR 0003). */
  risk_register?: RiskRegisterSummary;
};

/** Single geo event for manager map (from GET /api/manager/map-events). */
export type MapEvent = {
  lat: number;
  lng: number;
  type: string;
  time: string;
  driver_name: string;
  sheetId: string;
  week_starting: string;
  day_label?: string;
  accuracy?: number;
};

export type MessageThreadSummary = {
  id: string;
  subject: string;
  status: "open" | "closed" | string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string | null; email: string | null };
  sheet?: { id: string; week_starting: string; driver_name: string } | null;
  lastMessage?: { body: string; createdAt: string; senderName: string | null } | null;
};

export type MessageItem = {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string | null; email: string | null; role?: string | null };
};

export const api = {
  compliance: {
    check: (payload: {
      days: Array<{
        work_time?: boolean[];
        breaks?: boolean[];
        non_work?: boolean[];
        events?: { time: string; type: string }[];
      }>;
      driverType?: string;
      prevWeekDays?: Array<{ work_time?: boolean[]; breaks?: boolean[]; non_work?: boolean[]; events?: { time: string; type: string }[] }> | null;
      historyDays?: Array<{ work_time?: boolean[]; breaks?: boolean[]; non_work?: boolean[]; events?: { time: string; type: string }[] }> | null;
      last24hBreak?: string;
      weekStarting?: string;
      prevWeekStarting?: string;
      currentDayIndex?: number;
      /** Minutes since local midnight for “now” on the active day (0–1440). */
      slotOffsetWithinToday?: number;
      jurisdiction_code?: string;
    }) =>
      fetchApi<{ results: ComplianceCheckResult[] }>("/api/compliance/check", {
        method: "POST",
        body: payload,
      }),
  },
  regos: {
    list: () => fetchApi<Rego[]>("/api/regos"),
    create: (data: { label: string; sort_order?: number }) =>
      fetchApi<Rego>("/api/regos", { method: "POST", body: data }),
    update: (id: string, data: { label?: string; sort_order?: number }) =>
      fetchApi<Rego>(`/api/regos/${id}`, { method: "PATCH", body: data }),
    delete: (id: string) => fetchApi<void>(`/api/regos/${id}`, { method: "DELETE" }),
  },
  drivers: {
    list: () => fetchApi<Driver[]>("/api/drivers"),
    create: (data: {
      name: string;
      email?: string;
      licence_number?: string;
      cvd_medical_expiry?: string | null;
      is_active?: boolean;
      password?: string;
    }) => fetchApi<Driver>("/api/drivers", { method: "POST", body: data }),
    update: (
      id: string,
      data: {
        is_active?: boolean;
        name?: string;
        email?: string | null;
        licence_number?: string | null;
        cvd_medical_expiry?: string | null;
        password?: string;
      }
    ) => fetchApi<Driver>(`/api/drivers/${id}`, { method: "PATCH", body: data }),
    delete: (id: string) =>
      fetchApi<void>(`/api/drivers/${id}`, { method: "DELETE" }),
  },
  driver: {
    roadsideProducePdfUrl: () => `${base}/api/driver/roadside-produce`,
  },
  sheets: {
    list: () => fetchApi<FatigueSheet[]>("/api/sheets"),
    get: (id: string) => fetchApi<FatigueSheet>(`/api/sheets/${id}`),
    complianceHistory: (id: string) =>
      fetchApi<{
        prev_week_starting: string | null;
        prev_week_days: FatigueSheet["days"] | null;
        history_days: FatigueSheet["days"];
        lookback_weeks: number;
        policy: RecordRetentionPolicy;
      }>(`/api/sheets/${id}/compliance-history`),
    regoMaxEndKms: (
      rego: string,
      options?: { excludeSheetId?: string; beforeWeekStarting?: string }
    ) => {
      const params = new URLSearchParams({ rego });
      if (options?.excludeSheetId) params.set("excludeSheetId", options.excludeSheetId);
      if (options?.beforeWeekStarting) params.set("beforeWeekStarting", options.beforeWeekStarting);
      return fetchApi<{ maxEndKms: number | null }>(`/api/rego-kms?${params.toString()}`);
    },
    create: (data: Omit<FatigueSheet, "id" | "created_date">) =>
      fetchApi<FatigueSheet>("/api/sheets", { method: "POST", body: data }),
    update: (id: string, data: SheetUpdatePayload) =>
      fetchApi<FatigueSheet>(`/api/sheets/${id}`, { method: "PATCH", body: data }),
    delete: (id: string) =>
      fetchApi<void>(`/api/sheets/${id}`, { method: "DELETE" }),
    exportPdfUrl: (id: string) => `${base}/api/sheets/${id}/export`,
  },
  users: {
    listManagers: () =>
      fetchApi<{ managers: { id: string; email: string | null; name: string | null }[] }>("/api/users"),
    create: (data: { email: string; name?: string; password?: string }) =>
      fetchApi<{ id: string; email: string | null; name: string | null }>("/api/users", {
        method: "POST",
        body: data,
      }),
  },
  manager: {
    /** Compliance for manager-selected work week (+ prior week for assurance). */
    compliance: (params: { weekStarting: string }) => {
      const q = new URLSearchParams({ weekStarting: params.weekStarting });
      return fetchApi<{
        items: ManagerComplianceItem[];
        policy: RecordRetentionPolicy;
        focus_week: string;
        weeks_evaluated: string[];
      }>(`/api/manager/compliance?${q.toString()}`);
    },
    /** Geo events for map (manager only). Optional filters: weekStarting, driverName. */
    mapEvents: (params?: { weekStarting?: string; driverName?: string }) => {
      const sp = new URLSearchParams();
      if (params?.weekStarting) sp.set("weekStarting", params.weekStarting);
      if (params?.driverName) sp.set("driverName", params.driverName);
      const q = sp.toString();
      return fetchApi<{ events: MapEvent[] }>(
        `/api/manager/map-events${q ? `?${q}` : ""}`
      );
    },
  },
  messages: {
    threads: () => fetchApi<{ threads: MessageThreadSummary[] }>("/api/messages/threads"),
    createThread: (data: { subject: string; body: string; sheetId?: string | null }) =>
      fetchApi<{ thread: MessageThreadSummary }>("/api/messages/threads", { method: "POST", body: data }),
    thread: (id: string) => fetchApi<{ thread: MessageThreadSummary; messages: MessageItem[] }>(`/api/messages/threads/${id}`),
    postMessage: (threadId: string, data: { body: string }) =>
      fetchApi<{ message: MessageItem }>(`/api/messages/threads/${threadId}/messages`, { method: "POST", body: data }),
  },
};
