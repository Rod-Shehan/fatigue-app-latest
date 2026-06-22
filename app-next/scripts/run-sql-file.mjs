import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(path) {
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const envFile = process.argv[3] ?? ".env.production.local";
const sqlPath = process.argv[2];
if (!sqlPath) {
  console.error("Usage: node scripts/run-sql-file.mjs <sql-file> [env-file]");
  process.exit(1);
}

loadEnvFile(envFile);
const prisma = new PrismaClient();
const sql = readFileSync(sqlPath, "utf8");
const statements = sql
  .split(/;\s*(?:\r?\n|$)/)
  .map((s) => s.replace(/--.*$/gm, "").trim())
  .filter(Boolean);

try {
  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
    console.log("OK:", stmt.split(/\s+/).slice(0, 6).join(" ") + "...");
  }
  console.log("Done:", sqlPath);
} finally {
  await prisma.$disconnect();
}
