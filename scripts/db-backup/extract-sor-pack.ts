/**
 * Extract an electronic SoR pack (FatigueSheet data + signature + audit) for a week range.
 *
 * Doctrine: PDF is optional reproduction — this pack is the produceable record.
 *
 * Env:
 *   DATABASE_URL or DATABASE_URL_UNPOOLED — Postgres to query
 *     (pilot H1: live Neon is fine; after graduation use a restored throwaway DB)
 *   FROM_WEEK — YYYY-MM-DD (Sunday weekStarting inclusive)
 *   TO_WEEK — YYYY-MM-DD inclusive
 * Optional:
 *   DRIVER_NAME — filter one driver
 *   REQUEST_ID — echo into pack metadata
 *   REASON — echo into pack metadata
 *   OUT_PATH — default work/sor-pack-<stamp>.json
 *
 * @see app-next/docs/ops/cold-access-fulfillment.md
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import pg from "pg";
import { requireEnv } from "./r2-client.js";

const { Client } = pg;

const WEEK_YMD = /^\d{4}-\d{2}-\d{2}$/;

type SheetRow = {
  id: string;
  jurisdictionCode: string;
  driverName: string;
  secondDriver: string | null;
  driverType: string;
  weekStarting: string;
  days: string;
  status: string;
  signature: string | null;
  signedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AuditRow = {
  id: string;
  sheetId: string;
  actorId: string | null;
  action: string;
  payload: unknown;
  createdAt: Date;
};

async function main(): Promise<void> {
  const databaseUrl =
    process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("Set DATABASE_URL_UNPOOLED or DATABASE_URL");
  }

  const fromWeek = requireEnv("FROM_WEEK");
  const toWeek = requireEnv("TO_WEEK");
  if (!WEEK_YMD.test(fromWeek) || !WEEK_YMD.test(toWeek)) {
    throw new Error("FROM_WEEK and TO_WEEK must be YYYY-MM-DD");
  }
  if (fromWeek > toWeek) {
    throw new Error("FROM_WEEK must be <= TO_WEEK");
  }

  const driverName = process.env.DRIVER_NAME?.trim() || null;
  const requestId = process.env.REQUEST_ID?.trim() || null;
  const reason = process.env.REASON?.trim() || null;
  const source = process.env.SOR_SOURCE?.trim() || "database";

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath =
    process.env.OUT_PATH?.trim() || join("work", `sor-pack-${stamp}.json`);

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("sslmode=require") || databaseUrl.includes("neon.tech")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  await client.connect();
  try {
    const params: unknown[] = [fromWeek, toWeek];
    let sql = `
      SELECT id, "jurisdictionCode", "driverName", "secondDriver", "driverType",
             "weekStarting", days, status, signature, "signedAt", "createdAt", "updatedAt"
      FROM "FatigueSheet"
      WHERE "weekStarting" >= $1 AND "weekStarting" <= $2
    `;
    if (driverName) {
      params.push(driverName);
      sql += ` AND "driverName" = $${params.length}`;
    }
    sql += ` ORDER BY "weekStarting" ASC, "driverName" ASC`;

    const sheetsRes = await client.query<SheetRow>(sql, params);
    const sheetIds = sheetsRes.rows.map((r) => r.id);

    let audits: AuditRow[] = [];
    if (sheetIds.length) {
      const auditRes = await client.query<AuditRow>(
        `
        SELECT id, "sheetId", "actorId", action, payload, "createdAt"
        FROM "AuditEvent"
        WHERE "sheetId" = ANY($1::text[])
        ORDER BY "createdAt" ASC
        `,
        [sheetIds]
      );
      audits = auditRes.rows;
    }

    const auditsBySheet = new Map<string, AuditRow[]>();
    for (const a of audits) {
      const list = auditsBySheet.get(a.sheetId) ?? [];
      list.push(a);
      auditsBySheet.set(a.sheetId, list);
    }

    const pack = {
      schemaVersion: 1,
      artefact: "circadia-electronic-sor-pack",
      doctrine:
        "Electronic system of record = structured sheet data + signature image + attestation metadata + audit. PDF is an optional reproduction, not the SoR.",
      producedAt: new Date().toISOString(),
      source,
      request: {
        requestId,
        reason,
        fromWeekStarting: fromWeek,
        toWeekStarting: toWeek,
        driverName,
      },
      retentionNote:
        "Retain and produce per WA Reg 184G / HVNL-style obligations (≥ ~3 years). Cold retrieval SLA: 2 business days AWST (standard).",
      sheetCount: sheetsRes.rows.length,
      sheets: sheetsRes.rows.map((s) => {
        let daysParsed: unknown = s.days;
        try {
          daysParsed = JSON.parse(s.days);
        } catch {
          /* keep raw string */
        }
        return {
          id: s.id,
          jurisdictionCode: s.jurisdictionCode,
          driverName: s.driverName,
          secondDriver: s.secondDriver,
          driverType: s.driverType,
          weekStarting: s.weekStarting,
          status: s.status,
          signedAt: s.signedAt?.toISOString() ?? null,
          signature: s.signature,
          days: daysParsed,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
          auditEvents: (auditsBySheet.get(s.id) ?? []).map((a) => ({
            id: a.id,
            actorId: a.actorId,
            action: a.action,
            payload: a.payload,
            createdAt: a.createdAt.toISOString(),
          })),
        };
      }),
    };

    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify(pack, null, 2), "utf8");

    console.log(
      JSON.stringify({
        event: "sor_pack_ok",
        outPath,
        sheetCount: pack.sheetCount,
        fromWeek,
        toWeek,
        driverName,
      })
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
