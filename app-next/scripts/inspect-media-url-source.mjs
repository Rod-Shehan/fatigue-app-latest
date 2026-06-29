import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1].trim()] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(".env.local");

const prisma = new PrismaClient();
const row = await prisma.autonomiseWebhookIngest.findFirst({
  where: { kind: "media", NOT: { mediaUrl: null } },
  orderBy: { receivedAt: "desc" },
  select: { mediaUrl: true, payload: true, linkedEventId: true, receivedAt: true },
});

console.log(JSON.stringify(row, null, 2));

const withUrl = await prisma.autonomiseWebhookIngest.findMany({
  where: { kind: "event", accepted: true, NOT: { mediaUrl: null } },
  take: 3,
  select: { vendorEventId: true, mediaUrl: true, vendorAlarmId: true, receivedAt: true },
});
console.log("\nAccepted events WITH url:", withUrl);

await prisma.$disconnect();
