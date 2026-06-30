import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[m[1]] = val;
    }
  } catch {
    // ignore
  }
}

for (const f of [".env.production.local", ".env.local", ".env"]) loadEnv(f);

const prisma = new PrismaClient();
const sql = readFileSync(
  new URL("../../circadia-command/prisma/sql/004_incident_closed_notify.sql", import.meta.url),
  "utf8"
);

try {
  await prisma.$executeRawUnsafe(sql);
  console.log("Applied 004_incident_closed_notify.sql");
} finally {
  await prisma.$disconnect();
}
