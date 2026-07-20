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
    const e = new Error(msg) as Error & { body?: Record<string, unknown>; status?: number };
    e.body = err as Record<string, unknown>;
    e.status = res.status;
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
  has_password?: boolean;
  password_set_at?: string | null;
};

export type AdminPasswordSetResponse = {
  temporary_password?: string;
};

export type ManagerAccount = {
  id: string;
  email: string | null;
  name: string | null;
  has_password?: boolean;
  password_set_at?: string | null;
};
export type Rego = { id: string; label: string; sort_order: number };

export type RoutePreset = {
  id: string;
  label: string;
  start_location: string | null;
  destination: string | null;
  planned_distance_km: number | null;
  planned_on_duty_hours: number | null;
  catalogue_source: "fleet" | "driver";
  created_by_name: string | null;
  sort_order: number;
};
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
    /**
     * Optional ~10s GPS crumbs from the minute before this log fix
     * (oldest → newest). Used on the manager map as a short trail.
     */
    history_1m?: Array<{ lat: number; lng: number; t: string }>;
  /** @deprecated Legacy shared-sheet tag — not set on new events. */
    driver?: "primary" | "second";
  }>;
  /** When set (ISO string), legacy grid cap only — prefer end-shift events on the rolling timeline. */
  assume_idle_from?: string;
  /** Prospective run plan (ADR 0003) — future segments only for risk engine. */
  route_label?: string;
  planned_distance_km?: number | null;
  planned_on_duty_hours?: number | null;
  route_source?: "adhoc" | "driver_saved" | "org_preset";
  route_preset_id?: string;
  /** Self-reported alertness 1–5 at day/shift setup (risk context only — not FFW). */
  alertness_level?: 1 | 2 | 3 | 4 | 5;
  /** Crew for this calendar day — saved in Set up day; drives solo vs two-up rules. */
  driver_type?: "solo" | "two_up";
  second_driver?: string;
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
  last_24h_break?: string | null;
  /** Declared solo 24h non-work rests (Reg 184E(2)(b)) when logs cannot prove them. */
  last_24h_rest_1?: string | null;
  last_24h_rest_2?: string | null;
  last_24h_rest_3?: string | null;
  last_24h_rest_4?: string | null;
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

/** Camera fatigue alert from Autonomise webhook ingest (manager live inbox). */
export type CameraAlertTriageStatus = "pending" | "authorized" | "dismissed";

export type CameraAlertEventSettingsEntry = {
  vendorAlarmId: string;
  displayName: string;
  tier: string;
  family: string;
  enabled: boolean;
  defaultEnabled: boolean;
};

export type CameraAlertEventSettingsSnapshot = {
  enabledAlarmIds: string[];
  entries: CameraAlertEventSettingsEntry[];
  envPreset: string;
  updatedAt: string | null;
};

export type {
  TriageShiftAssignees,
  TriageShiftPublic,
  TriageShiftSnapshot,
} from "@/lib/triage-shift";

export type TriageShiftAdminSnapshot = {
  shifts: import("@/lib/triage-shift").TriageShiftPublic[];
  managerUsers: { id: string; name: string | null; email: string | null; role: string }[];
  commandOperators: import("@/lib/triage-shift").TriageShiftAssigneeOperator[];
};

export type TriageShiftCurrentResponse = {
  snapshot: import("@/lib/triage-shift").TriageShiftSnapshot;
  viewer: { onShift: boolean; userId: string };
};

export type CameraAlertItem = {
  id: string;
  /** Autonomise ingest row when bridged; required for delete when id is lifecycle. */
  ingestEventId?: string | null;
  vendorEventId: string | null;
  vendorAlarmId: string | null;
  displayName: string | null;
  tier: string | null;
  vehicleRego: string | null;
  driverName: string | null;
  deviceHardwareId: string | null;
  receivedAt: string;
  triggerAt?: string | null;
  accepted: boolean;
  rejectReason: string | null;
  mediaUrl: string | null;
  mediaPending: boolean;
  mediaUnavailable?: boolean;
  triageStatus: CameraAlertTriageStatus;
  triageDecidedAt: string | null;
  triageDecidedBy: string | null;
  triageNote: string | null;
  triageFalsePositiveReasons?: string[];
  triageVerifiedDistractionReasons?: string[];
  eventWebhookPending?: boolean;
  lifecycleId?: string | null;
  queueBurstLabel?: string | null;
  claimedByActorType?: "manager" | "command_operator" | null;
  claimedByLabel?: string | null;
  claimedAt?: string | null;
  claimedByYou?: boolean;
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

/** GPS movement crumb for manager map trail (legacy field name history_1m). */
export type MapHistory1mPoint = {
  lat: number;
  lng: number;
  t: string;
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
  /** GPS movement trail since previous log (legacy field name history_1m). */
  history_1m?: MapHistory1mPoint[];
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
      declared24hRests?: {
        last_24h_rest_1?: string | null;
        last_24h_rest_2?: string | null;
        last_24h_rest_3?: string | null;
        last_24h_rest_4?: string | null;
      } | null;
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
  routePresets: {
    list: () => fetchApi<RoutePreset[]>("/api/route-presets"),
    create: (data: {
      label: string;
      start_location?: string | null;
      destination?: string | null;
      planned_distance_km?: number | null;
      planned_on_duty_hours?: number | null;
      catalogue_source?: "fleet" | "driver";
      sort_order?: number;
    }) => fetchApi<RoutePreset>("/api/route-presets", { method: "POST", body: data }),
    update: (
      id: string,
      data: {
        label?: string;
        start_location?: string | null;
        destination?: string | null;
        planned_distance_km?: number | null;
        planned_on_duty_hours?: number | null;
        sort_order?: number;
        is_active?: boolean;
      }
    ) => fetchApi<RoutePreset>(`/api/route-presets/${id}`, { method: "PATCH", body: data }),
    delete: (id: string) => fetchApi<void>(`/api/route-presets/${id}`, { method: "DELETE" }),
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
    }) => fetchApi<Driver & AdminPasswordSetResponse>("/api/drivers", { method: "POST", body: data }),
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
    ) => fetchApi<Driver & AdminPasswordSetResponse>(`/api/drivers/${id}`, { method: "PATCH", body: data }),
    delete: (id: string) =>
      fetchApi<void>(`/api/drivers/${id}`, { method: "DELETE" }),
  },
  driver: {
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      fetchApi<{ ok: true }>("/api/driver/change-password", { method: "POST", body: data }),
    roadsideProducePdfUrl: () => `${base}/api/driver/roadside-produce`,
    uploadRiskBlocks: (data: {
      blocks: Array<{
        upload_id: string;
        block_start_ms: number;
        camera: import("@/lib/camera-risk-packet").CameraRiskPacketV1;
        diary?: import("@/lib/camera-risk-packet").RiskBlockDiaryContext;
      }>;
    }) =>
      fetchApi<{
        ok: boolean;
        accepted: number;
        skipped: number;
        results: { upload_id: string; created: boolean; live_pct: number }[];
      }>("/api/driver/risk-blocks", { method: "POST", body: data }),
  },
  sheets: {
    list: (options?: { meta?: boolean; weekStarting?: string }) => {
      const params = new URLSearchParams();
      if (options?.meta) params.set("meta", "1");
      if (options?.weekStarting) params.set("weekStarting", options.weekStarting);
      const q = params.toString();
      return fetchApi<FatigueSheet[]>(`/api/sheets${q ? `?${q}` : ""}`);
    },
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
      fetchApi<{ managers: ManagerAccount[] }>("/api/users"),
    create: (data: { email: string; name?: string; password?: string }) =>
      fetchApi<ManagerAccount & AdminPasswordSetResponse>("/api/users", {
        method: "POST",
        body: data,
      }),
    update: (id: string, data: { name?: string; password?: string }) =>
      fetchApi<ManagerAccount & AdminPasswordSetResponse>(`/api/users/${id}`, {
        method: "PATCH",
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
    riskTimeline: (params: { driverName: string; fromMs?: number; toMs?: number; weekStarting?: string }) => {
      const sp = new URLSearchParams({ driverName: params.driverName });
      if (params.fromMs != null) sp.set("fromMs", String(params.fromMs));
      if (params.toMs != null) sp.set("toMs", String(params.toMs));
      if (params.weekStarting) sp.set("weekStarting", params.weekStarting);
      return fetchApi<{
        series: import("@/lib/manager-risk-timeline").RiskTimelineSeries;
        block_count: number;
        snapshot_count: number;
        latest_camera: import("@/lib/camera-risk-packet").CameraBlockFeatures | null;
        scoring_engine: "frms" | "legacy";
        frms_cache_status: string | null;
        frms_run_id: string | null;
        disclaimer: string;
      }>(`/api/manager/risk-timeline?${sp.toString()}`);
    },
    fleetRiskTimeline: (params: { weekStarting?: string; driverNames?: string[] }) => {
      const sp = new URLSearchParams();
      if (params.weekStarting) sp.set("weekStarting", params.weekStarting);
      if (params.driverNames?.length) sp.set("driverNames", params.driverNames.join(","));
      const q = sp.toString();
      return fetchApi<import("@/lib/frms/fleet-risk-timeline").FleetRiskTimelineResult & {
        frms_engine_mode: string;
      }>(`/api/manager/fleet-risk-timeline${q ? `?${q}` : ""}`);
    },
    /** Autonomise fatigue camera alerts (live inbox). */
    cameraAlerts: (params?: {
      acceptedOnly?: boolean;
      hours?: number;
      triageFilter?: "all" | "pending" | "decided";
      backfillMedia?: boolean;
      limit?: number;
    }) => {
      const sp = new URLSearchParams();
      if (params?.acceptedOnly === false) sp.set("acceptedOnly", "false");
      if (params?.hours != null) sp.set("hours", String(params.hours));
      if (params?.triageFilter) sp.set("triageFilter", params.triageFilter);
      if (params?.backfillMedia === true) sp.set("backfillMedia", "true");
      if (params?.limit != null) sp.set("limit", String(params.limit));
      const q = sp.toString();
      return fetchApi<{
        alerts: CameraAlertItem[];
        configured: boolean;
        testingTools?: { allowDelete: boolean };
        queueSummary?: { activePending: number; browseHours: number | null };
        diagnostics?: {
          ingestEvents: number;
          ingestEventsRejected: number;
          ingestMedia: number;
          mediaWithoutMatchingEvent: number;
          apiConfigured: boolean;
          clipsWithMediaFilteredOut?: number;
        };
      }>(`/api/manager/camera-alerts${q ? `?${q}` : ""}`);
    },
    cameraAlertDelete: (ingestEventId: string) =>
      fetchApi<{
        ok: boolean;
        deletedIngestIds: string[];
        deletedMediaRows: number;
        deletedTriageRows: number;
      }>(`/api/manager/camera-alerts/${ingestEventId}`, { method: "DELETE" }),
    cameraAlertBulkDelete: (ids: string[]) =>
      fetchApi<{
        ok: boolean;
        deletedIngestIds: string[];
        deletedMediaRows: number;
        deletedTriageRows: number;
        notFoundIds: string[];
        failedIds: string[];
      }>(`/api/manager/camera-alerts/bulk-delete`, {
        method: "POST",
        body: { ids },
      }),
    cameraAlertTriage: (
      ingestEventId: string,
      data: {
        decision: "authorized" | "dismissed";
        note?: string | null;
        vendorEventId?: string | null;
        falsePositiveReasons?: string[];
      }
    ) =>
      fetchApi<{
        ok: boolean;
        triage: {
          ingestEventId: string;
          decision: string;
          note: string | null;
          falsePositiveReasons?: string[];
          decidedByEmail: string | null;
          decidedAt: string;
        };
      }>(`/api/manager/camera-alerts/${ingestEventId}/triage`, { method: "POST", body: data }),
    cameraAlertVerifyDistraction: (
      ingestEventId: string,
      data: {
        verifiedDistractionReasons: string[];
        note?: string | null;
        vendorEventId?: string | null;
      }
    ) =>
      fetchApi<{
        ok: boolean;
        triage: {
          ingestEventId: string;
          decision: string;
          note: string | null;
          verifiedDistractionReasons?: string[];
          decidedByEmail: string | null;
          decidedAt: string;
        };
        lifecycleId: string | null;
        lifecycleStatus: string | null;
      }>(`/api/manager/camera-alerts/${ingestEventId}/verify-distraction`, {
        method: "POST",
        body: data,
      }),
    cameraAlertResolve: (
      ingestEventId: string,
      data: {
        actionType: import("@/lib/triage-resolution").IncidentResolutionActionType;
        resolutionNotes?: string | null;
        vendorEventId?: string | null;
      }
    ) =>
      fetchApi<{
        ok: boolean;
        triage: {
          ingestEventId: string;
          decision: string;
          note: string | null;
          decidedByEmail: string | null;
          decidedAt: string;
        };
        lifecycleId: string | null;
        lifecycleStatus: string | null;
      }>(`/api/manager/camera-alerts/${ingestEventId}/resolve`, { method: "POST", body: data }),
    cameraAlertClaim: (ingestEventId: string) =>
      fetchApi<{ ok: boolean; claim: import("@/lib/integrations/incident-claim").IncidentClaimView }>(
        `/api/manager/camera-alerts/${ingestEventId}/claim`,
        { method: "POST" }
      ),
    cameraAlertReleaseClaim: (ingestEventId: string) =>
      fetchApi<{ ok: boolean; lifecycleId: string }>(
        `/api/manager/camera-alerts/${ingestEventId}/claim`,
        { method: "DELETE" }
      ),
    cameraAlertActivity: (ingestEventId: string) =>
      fetchApi<{
        entries: import("@/lib/integrations/incident-activity-timeline").IncidentActivityEntry[];
      }>(`/api/manager/camera-alerts/${ingestEventId}/activity`),
    cameraAlertEventSettings: () =>
      fetchApi<{ settings: CameraAlertEventSettingsSnapshot }>(
        "/api/manager/camera-alerts/event-settings"
      ),
    updateCameraAlertEventSettings: (enabledAlarmIds: string[]) =>
      fetchApi<{ settings: CameraAlertEventSettingsSnapshot }>(
        "/api/manager/camera-alerts/event-settings",
        { method: "PATCH", body: { enabledAlarmIds } }
      ),
  },
  triageShiftCurrent: () =>
    fetchApi<TriageShiftCurrentResponse>("/api/triage-shift/current"),
  messages: {
    threads: () => fetchApi<{ threads: MessageThreadSummary[] }>("/api/messages/threads"),
    createThread: (data: { subject: string; body: string; sheetId?: string | null }) =>
      fetchApi<{ thread: MessageThreadSummary }>("/api/messages/threads", { method: "POST", body: data }),
    thread: (id: string) => fetchApi<{ thread: MessageThreadSummary; messages: MessageItem[] }>(`/api/messages/threads/${id}`),
    postMessage: (threadId: string, data: { body: string }) =>
      fetchApi<{ message: MessageItem }>(`/api/messages/threads/${threadId}/messages`, { method: "POST", body: data }),
  },
  admin: {
    getPolicy: () =>
      fetchApi<{ policy: import("@/lib/system-policy").SystemPolicySnapshot }>("/api/admin/policy"),
    updatePolicy: (patch: Partial<import("@/lib/system-policy").SystemPolicySnapshot>) =>
      fetchApi<{ policy: import("@/lib/system-policy").SystemPolicySnapshot }>("/api/admin/policy", {
        method: "PATCH",
        body: patch,
      }),
    claimOwner: () => fetchApi<{ ok: boolean }>("/api/admin/claim-owner", { method: "POST" }),
    listUsers: () =>
      fetchApi<{
        users: {
          id: string;
          email: string | null;
          name: string | null;
          role: string;
          disabled: boolean;
        }[];
      }>("/api/admin/users"),
    patchUser: (id: string, data: { disabled?: boolean; role?: "driver" | "manager" }) =>
      fetchApi<{ user: { id: string; email: string | null; name: string | null; role: string; disabled: boolean } }>(
        `/api/admin/users/${id}`,
        { method: "PATCH", body: data }
      ),
    deleteUser: (id: string) => fetchApi<void>(`/api/admin/users/${id}`, { method: "DELETE" }),
    auditExportUrl: (params?: { from?: string; to?: string }) => {
      const sp = new URLSearchParams();
      if (params?.from) sp.set("from", params.from);
      if (params?.to) sp.set("to", params.to);
      const q = sp.toString();
      return `${base}/api/admin/audit-export${q ? `?${q}` : ""}`;
    },
    listTriageShifts: () => fetchApi<TriageShiftAdminSnapshot>("/api/admin/triage-shift"),
    createTriageShift: (body: {
      startsAtLocal: string;
      endsAtLocal: string;
      assignees: import("@/lib/triage-shift").TriageShiftAssignees;
      handoffNote?: string | null;
    }) =>
      fetchApi<{ shift: import("@/lib/triage-shift").TriageShiftPublic }>("/api/admin/triage-shift", {
        method: "POST",
        body,
      }),
    updateTriageShift: (
      id: string,
      body: {
        startsAtLocal: string;
        endsAtLocal: string;
        assignees: import("@/lib/triage-shift").TriageShiftAssignees;
        handoffNote?: string | null;
      }
    ) =>
      fetchApi<{ shift: import("@/lib/triage-shift").TriageShiftPublic }>(
        `/api/admin/triage-shift/${id}`,
        { method: "PATCH", body }
      ),
    deleteTriageShift: (id: string) =>
      fetchApi<{ ok: boolean }>(`/api/admin/triage-shift/${id}`, { method: "DELETE" }),
  },
};
