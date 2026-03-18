/**
 * API client – replaces Base44 SDK calls.
 * All routes require an active session (cookie).
 */

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

export type Driver = { id: string; name: string; email?: string | null; licence_number?: string; is_active: boolean };
export type Rego = { id: string; label: string; sort_order: number };
export type DayData = {
  day_label?: string;
  date?: string;
  truck_rego?: string;
  destination?: string;
  start_kms?: number | null;
  end_kms?: number | null;
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
};
export type FatigueSheet = {
  id: string;
  driver_name: string;
  second_driver?: string;
  driver_type: string;
  destination?: string;
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
  type: "violation" | "warning";
  iconKey: "Coffee" | "AlertTriangle" | "Moon" | "Clock" | "TrendingUp" | "CheckCircle2" | "MapPin";
  day: string;
  message: string;
};

/** One sheet's compliance results for manager oversight. */
export type ManagerComplianceItem = {
  sheetId: string;
  driver_name: string;
  week_starting: string;
  results: ComplianceCheckResult[];
  eventsWithLocation?: number;
  totalEvents?: number;
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
      last24hBreak?: string;
      weekStarting?: string;
      prevWeekStarting?: string;
      currentDayIndex?: number;
      slotOffsetWithinToday?: number;
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
    create: (data: { name: string; email?: string; licence_number?: string; is_active?: boolean }) =>
      fetchApi<Driver>("/api/drivers", { method: "POST", body: data }),
    update: (id: string, data: { is_active?: boolean; name?: string; email?: string | null }) =>
      fetchApi<Driver>(`/api/drivers/${id}`, { method: "PATCH", body: data }),
    delete: (id: string) =>
      fetchApi<void>(`/api/drivers/${id}`, { method: "DELETE" }),
  },
  sheets: {
    list: () => fetchApi<FatigueSheet[]>("/api/sheets"),
    get: (id: string) => fetchApi<FatigueSheet>(`/api/sheets/${id}`),
    regoMaxEndKms: (rego: string) =>
      fetchApi<{ maxEndKms: number | null }>(`/api/rego-kms?rego=${encodeURIComponent(rego)}`),
    create: (data: Omit<FatigueSheet, "id" | "created_date">) =>
      fetchApi<FatigueSheet>("/api/sheets", { method: "POST", body: data }),
    update: (id: string, data: SheetUpdatePayload) =>
      fetchApi<FatigueSheet>(`/api/sheets/${id}`, { method: "PATCH", body: data }),
    delete: (id: string) =>
      fetchApi<void>(`/api/sheets/${id}`, { method: "DELETE" }),
    exportPdfUrl: (id: string) => `${base}/api/sheets/${id}/export`,
  },
  users: {
    create: (data: { email: string; name?: string }) =>
      fetchApi<{ id: string; email: string | null; name: string | null }>("/api/users", {
        method: "POST",
        body: data,
      }),
  },
  manager: {
    /** All drivers' compliance results (manager only). */
    compliance: () =>
      fetchApi<{ items: ManagerComplianceItem[] }>("/api/manager/compliance"),
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
};
