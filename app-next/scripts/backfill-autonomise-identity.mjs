import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { resolveAndPersistAutonomiseIdentity } from "../src/lib/integrations/autonomise-identity-resolver.ts";

function loadEnvFile(path) {
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}

loadEnvFile(".env.production.local");
if (!process.env.AUTONOMISE_PRIMARY_KEY) {
  loadEnvFile(
    `${process.env.USERPROFILE ?? ""}/OneDrive/Documents/autonomise-fleet-alerts/backend/.env`
  );
}

const prisma = new PrismaClient();
try {
  const rows = await prisma.autonomiseWebhookIngest.findMany({
    where: { kind: "event", accepted: true },
  });
  for (const row of rows) {
    const result = await resolveAndPersistAutonomiseIdentity(prisma, {
      ingestId: row.id,
      payload: row.payload,
    });
    console.log(row.id, result);
  }
} finally {
  await prisma.$disconnect();
}
