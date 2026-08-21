import type { FrmsTimelinePayload } from "@/lib/frms/build-timeline-payload";

export type FrmsPythonSnapshot = {
  block_start_ms: number;
  process_s_pct?: number;
  process_c_pct?: number;
  model_pct?: number;
  combined_pct: number;
  band?: string;
  process_s?: number;
  process_c?: number;
  process_w?: number;
  tpma_biological_impairment?: number;
  task_strain_index?: number;
  effective_combined_risk?: number;
  is_nap?: boolean;
  activity_label?: string;
  task_strain_relief_active?: boolean;
  biological_sleep_deprived?: boolean;
};

export type FrmsPythonResponse = {
  engine_version: string;
  model_version?: string;
  prospective_register?: unknown;
  snapshots: FrmsPythonSnapshot[];
};

export async function callFrmsPython(
  payload: FrmsTimelinePayload,
  signal?: AbortSignal
): Promise<FrmsPythonResponse> {
  const base = process.env.FRMS_PYTHON_URL;
  const key = process.env.FRMS_PYTHON_API_KEY;
  if (!base || !key) {
    throw new Error("FRMS_PYTHON_URL / FRMS_PYTHON_API_KEY not configured");
  }

  const res = await fetch(`${base.replace(/\/$/, "")}/v1/risk-profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`FRMS Python ${res.status}: ${text.slice(0, 500)}`);
  }

  return (await res.json()) as FrmsPythonResponse;
}
