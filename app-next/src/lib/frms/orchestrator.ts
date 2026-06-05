import type { PrismaClient } from "@prisma/client";
import {
  buildFrmsTimelinePayload,
  hashFrmsPayload,
  type FrmsTimelinePayload,
} from "@/lib/frms/build-timeline-payload";
import { callFrmsPython } from "@/lib/frms/python-client";
import type { RiskRegisterResult } from "@/lib/risk-register";

export const FRMS_ENGINE_VERSION = "frms-py-1";

export type FrmsRunArgs = {
  driverName: string;
  weekStarting: string;
  weekMap: Map<string, { days: string }>;
  jurisdictionCode: string;
  driverType: string;
  userId?: string;
};

export type FrmsCacheStatus = "hit" | "stale" | "miss" | "legacy";

export function getFrmsEngineMode(): string {
  return process.env.FRMS_ENGINE ?? "legacy";
}

export function isFrmsEngineEnabled(): boolean {
  return getFrmsEngineMode() !== "legacy";
}

export function buildFrmsPayloadAndHash(args: FrmsRunArgs): {
  payload: FrmsTimelinePayload;
  inputHash: string;
} {
  const payload = buildFrmsTimelinePayload({
    driverName: args.driverName,
    weekStarting: args.weekStarting,
    weekMap: args.weekMap,
    jurisdictionCode: args.jurisdictionCode,
    driverType: args.driverType,
  });
  return { payload, inputHash: hashFrmsPayload(payload) };
}

export async function loadDriverWeekMap(
  prisma: PrismaClient,
  driverName: string
): Promise<Map<string, { days: string }>> {
  const rows = await prisma.fatigueSheet.findMany({
    where: { driverName },
    select: { weekStarting: true, days: true },
  });
  return new Map(rows.map((r) => [r.weekStarting, { days: r.days }]));
}

function asRiskRegister(value: unknown): RiskRegisterResult | null {
  if (!value || typeof value !== "object") return null;
  const v = value as RiskRegisterResult;
  if (!Array.isArray(v.entries)) return null;
  return v;
}

/**
 * Read path: return cached prospective register when input hash matches; otherwise enqueue recompute.
 * Serves last-good register while a stale recompute runs (non-blocking).
 */
export async function resolveFrmsProspectiveRegister(
  prisma: PrismaClient,
  args: FrmsRunArgs
): Promise<{
  register: RiskRegisterResult | null;
  cacheStatus: FrmsCacheStatus;
  runId: string | null;
}> {
  if (!isFrmsEngineEnabled()) {
    return { register: null, cacheStatus: "legacy", runId: null };
  }

  const { inputHash } = buildFrmsPayloadAndHash(args);

  const exact = await prisma.frmsProfileRun.findFirst({
    where: {
      driverName: args.driverName,
      inputHash,
      engineVersion: FRMS_ENGINE_VERSION,
      status: "ready",
    },
    orderBy: { completedAt: "desc" },
  });

  if (exact?.prospectiveRegister) {
    return {
      register: asRiskRegister(exact.prospectiveRegister),
      cacheStatus: "hit",
      runId: exact.id,
    };
  }

  const latest = await prisma.frmsProfileRun.findFirst({
    where: {
      driverName: args.driverName,
      weekStarting: args.weekStarting,
      status: "ready",
    },
    orderBy: { completedAt: "desc" },
  });

  enqueueFrmsRecompute({
    driverName: args.driverName,
    weekStarting: args.weekStarting,
    userId: args.userId,
  });

  if (latest?.prospectiveRegister) {
    return {
      register: asRiskRegister(latest.prospectiveRegister),
      cacheStatus: "stale",
      runId: latest.id,
    };
  }

  return { register: null, cacheStatus: "miss", runId: null };
}

/**
 * Worker path: build payload, skip Python when an identical ready run exists, else persist snapshots.
 */
export async function runFrmsAndPersist(
  prisma: PrismaClient,
  args: FrmsRunArgs
): Promise<{ runId: string; status: "ready" | "failed" | "cached" }> {
  const { payload, inputHash } = buildFrmsPayloadAndHash(args);

  const cached = await prisma.frmsProfileRun.findFirst({
    where: {
      driverName: args.driverName,
      inputHash,
      engineVersion: FRMS_ENGINE_VERSION,
      status: "ready",
    },
    orderBy: { completedAt: "desc" },
  });

  if (cached) {
    return { runId: cached.id, status: "cached" };
  }

  const run = await prisma.frmsProfileRun.upsert({
    where: {
      driverName_inputHash_engineVersion: {
        driverName: args.driverName,
        inputHash,
        engineVersion: FRMS_ENGINE_VERSION,
      },
    },
    create: {
      driverName: args.driverName,
      userId: args.userId,
      weekStarting: args.weekStarting,
      horizonFromMs: BigInt(payload.horizon_from_ms),
      horizonToMs: BigInt(payload.horizon_to_ms),
      inputHash,
      engineVersion: FRMS_ENGINE_VERSION,
      status: "pending",
      sources: ["diary"],
    },
    update: {
      status: "pending",
      errorMessage: null,
      requestedAt: new Date(),
      weekStarting: args.weekStarting,
      horizonFromMs: BigInt(payload.horizon_from_ms),
      horizonToMs: BigInt(payload.horizon_to_ms),
    },
  });

  try {
    const result = await callFrmsPython(payload);

    await prisma.$transaction([
      prisma.frmsRiskSnapshot.deleteMany({ where: { runId: run.id } }),
      prisma.frmsRiskSnapshot.createMany({
        data: result.snapshots.map((s) => ({
          runId: run.id,
          blockStartMs: BigInt(s.block_start_ms),
          processSPct: s.process_s_pct ?? null,
          processCPct: s.process_c_pct ?? null,
          modelPct: s.model_pct ?? null,
          combinedPct: Math.round(s.combined_pct),
          band: s.band ?? null,
        })),
      }),
      prisma.frmsProfileRun.update({
        where: { id: run.id },
        data: {
          status: "ready",
          modelVersion: result.model_version ?? null,
          prospectiveRegister:
            result.prospective_register !== undefined
              ? (result.prospective_register as object)
              : undefined,
          completedAt: new Date(),
          errorMessage: null,
        },
      }),
    ]);

    return { runId: run.id, status: "ready" };
  } catch (e) {
    await prisma.frmsProfileRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        errorMessage: e instanceof Error ? e.message : "FRMS failed",
      },
    });
    return { runId: run.id, status: "failed" };
  }
}

export type FrmsEnqueueArgs = Pick<FrmsRunArgs, "driverName" | "weekStarting" | "userId">;

/** Fire-and-forget internal worker — does not block driver/manager request latency. */
export function enqueueFrmsRecompute(args: FrmsEnqueueArgs): void {
  const secret = process.env.FRMS_INTERNAL_SECRET;
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.NEXTAUTH_URL ?? "http://localhost:3000");

  if (!secret || !isFrmsEngineEnabled()) return;

  void fetch(`${base.replace(/\/$/, "")}/api/internal/frms/recompute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      driverName: args.driverName,
      weekStarting: args.weekStarting,
      userId: args.userId,
    }),
  }).catch((err) => {
    console.error("enqueueFrmsRecompute failed:", err);
  });
}
