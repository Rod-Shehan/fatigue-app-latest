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

const files = [
  new URL("../../circadia-command/prisma/sql/005a_incident_claim_columns.sql", import.meta.url),
  new URL("../../circadia-command/prisma/sql/005b_incident_claim_index.sql", import.meta.url),
  new URL("../../circadia-command/prisma/sql/006_incident_claim_notify.sql", import.meta.url),
];

try {
  for (const fileUrl of files) {
    const sql = readFileSync(fileUrl, "utf8");
    await prisma.$executeRawUnsafe(sql);
    console.log(`Applied ${fileUrl.pathname.split("/").pop()}`);
  }
} finally {
  await prisma.$disconnect();
}
